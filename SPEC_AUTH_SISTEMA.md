# SPEC — Sistema de Autenticación

## Contexto y motivación

La app no tiene autenticación. Los usuarios están hardcodeados como constantes estáticas en `types/index.ts`. Se implementa Supabase Auth con email+contraseña, verificación OTP de 6 dígitos, y login con Google. El objetivo es que cada usuario tenga una cuenta real, persistente y segura desde la fase de beta.

---

## Seguridad del sistema

### Por qué la anon key pública no es un problema

La `anon key` embebida en la app es **intencionalmente pública**. Es equivalente a decir "eres un usuario anónimo". Solo puede ejecutar lo que las **políticas RLS** de Postgres permiten explícitamente. Sin RLS abierta, no puede leer nada.

### Capas de seguridad

| Capa | Qué protege |
|---|---|
| **HTTPS/WSS** | Todos los datos en tránsito cifrados con TLS |
| **JWT con expiración** | Tokens de sesión expiran en 1h, se refrescan automáticamente |
| **bcrypt** | Supabase nunca almacena contraseñas — solo el hash |
| **RLS (Row Level Security)** | Cada tabla define exactamente quién puede leer/escribir cada fila |
| **Email OTP** | Confirma que el email es real antes de crear la cuenta |
| **Google OAuth** | Google maneja las credenciales — la app nunca ve la contraseña |
| **Rate limiting** | Supabase limita intentos de login fallidos automáticamente |

### Endurecimiento de shared_state

Actualmente `shared_state` permite acceso a cualquier usuario `anon`. Tras implementar auth, se añade:

```sql
create policy shared_state_auth_select on public.shared_state
  for select to authenticated
  using (
    room_id = (select room_id from public.user_profiles where id = auth.uid())
  );

create policy shared_state_auth_update on public.shared_state
  for update to authenticated
  using (
    room_id = (select room_id from public.user_profiles where id = auth.uid())
  );
```

Esto hace imposible acceder a datos de otro room, incluso conociendo el room_id.

---

## Flujo de autenticación

```
App abre
    │
    ▼
¿Hay sesión guardada?
   NO  │   SÍ
       │       │
       ▼       ▼
  [/login]  ¿Tiene perfil completo?
               NO  │   SÍ
                   │       │
                   ▼       ▼
            [/onboarding]  Conecta al room
                            └─> app (tabs)
```

---

## Base de datos — `supabase/6_auth_and_profiles.sql`

### Tabla `user_profiles`

```sql
create table public.user_profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  name        text not null,
  initials    text not null,
  color       text not null default '#4F46E5',
  bg          text not null default '#E0E7FF',
  room_id     text,        -- null hasta completar onboarding; '{uuid}-main'
  partner_id  uuid references public.user_profiles(id),
  photo_url   text,
  created_at  timestamptz default now()
);

alter table public.user_profiles enable row level security;

-- Cada usuario solo puede leer su propio perfil directamente.
-- Para buscar a otra persona se usa la RPC find_partner_preview() — ver más abajo.
create policy profiles_select on public.user_profiles for select
  to authenticated using (id = auth.uid());

create policy profiles_insert on public.user_profiles for insert
  to authenticated with check (auth.uid() = id);

create policy profiles_update on public.user_profiles for update
  to authenticated using (auth.uid() = id) with check (auth.uid() = id);

grant select, insert, update on public.user_profiles to authenticated;
```

### Tabla `partner_invitations`

```sql
create table public.partner_invitations (
  id            uuid default gen_random_uuid() primary key,
  inviter_id    uuid references auth.users(id) on delete cascade not null,
  invitee_email text not null,
  status        text not null default 'pending',  -- 'pending'|'accepted'|'declined'
  created_at    timestamptz default now()
);

alter table public.partner_invitations enable row level security;

-- El invitante ve las que él creó
create policy invitations_select_inviter on public.partner_invitations
  for select to authenticated
  using (inviter_id = auth.uid());

-- El invitado ve las dirigidas a su email
create policy invitations_select_invitee on public.partner_invitations
  for select to authenticated
  using (invitee_email = (select email from public.user_profiles where id = auth.uid()));

create policy invitations_insert on public.partner_invitations
  for insert to authenticated with check (inviter_id = auth.uid());

grant select, insert on public.partner_invitations to authenticated;
```

### RPC `accept_partner_invitation`

```sql
create or replace function public.accept_partner_invitation(p_invitation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_my_id   uuid := auth.uid();
  v_inv     record;
  v_inviter record;
  v_room_id text;
begin
  select * into v_inv from partner_invitations
  where id = p_invitation_id and status = 'pending';

  if v_inv.id is null then
    return jsonb_build_object('error', 'invitation_not_found');
  end if;

  select * into v_inviter from user_profiles where id = v_inv.inviter_id;
  v_room_id := coalesce(v_inviter.room_id, v_inv.inviter_id::text || '-main');

  update user_profiles set room_id = v_room_id, partner_id = v_my_id
    where id = v_inv.inviter_id;
  update user_profiles set room_id = v_room_id, partner_id = v_inv.inviter_id
    where id = v_my_id;

  update partner_invitations set status = 'accepted' where id = p_invitation_id;

  return jsonb_build_object('success', true, 'room_id', v_room_id);
end;
$$;

create or replace function public.decline_partner_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update partner_invitations set status = 'declined'
  where id = p_invitation_id
    and invitee_email = (select email from user_profiles where id = auth.uid());
end;
$$;

grant execute on function public.accept_partner_invitation(uuid) to authenticated;
grant execute on function public.decline_partner_invitation(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC find_partner_preview — única puerta para buscar a otro usuario por email
--
-- Por qué existe esta RPC en vez de un SELECT directo:
--   La policy de user_profiles solo permite leer el propio perfil.
--   Esta función es el único canal controlado para buscar a otra persona.
--   Devuelve SOLO lo mínimo necesario para la UI de invitación (nombre,
--   iniciales, color). Nunca expone email, room_id ni datos financieros.
--   Esto protege la tabla ante cualquier escalado futuro (ej: integración
--   bancaria) sin necesidad de cambiar políticas.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.find_partner_preview(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result record;
begin
  select up.id, up.name, up.initials, up.color, up.bg
  into v_result
  from public.user_profiles up
  join auth.users au on au.id = up.id
  where lower(au.email) = lower(p_email)
    and up.id != auth.uid();

  if v_result.id is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found',    true,
    'id',       v_result.id,
    'name',     v_result.name,
    'initials', v_result.initials,
    'color',    v_result.color,
    'bg',       v_result.bg
  );
end;
$$;

grant execute on function public.find_partner_preview(text) to authenticated;
```

---

## Pasos manuales en Dashboard Supabase

> Hacer ANTES de implementar el código.

### 1. Email OTP (verificación con código)
- **Authentication → Settings**
- "Confirm email": ON
- "Secure email change": ON
- Activar "Email OTP" → los correos de confirmación enviarán un código de 6 dígitos en vez de un link
- OTP Expiry: 600 segundos (10 min)

### 2. Google OAuth
- **Authentication → Providers → Google** → Enable
- Ir a [Google Cloud Console](https://console.cloud.google.com)
  - Crear proyecto (o usar uno existente)
  - APIs & Services → Credentials → Create OAuth 2.0 Client ID
  - Application type: Web application
  - Authorized redirect URIs:
    - `https://kjihuesxwubqbyetlaet.supabase.co/auth/v1/callback`
    - `exp://localhost:8081` (para desarrollo con Expo Go)
    - `nosotros://auth/callback` (producción — requiere app.json actualizado)
- Copiar **Client ID** y **Client Secret** al dashboard de Supabase

### 3. app.json — esquema para deep links
```json
{
  "expo": {
    "scheme": "nosotros"
  }
}
```

---

## Nuevas funciones en `services/supabase.ts`

> Añadir al final del archivo existente — no modificar lo anterior.

```typescript
// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function verifyOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'signup' });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle(redirectTo: string) {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(cb: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(cb);
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function createProfile(params: {
  id: string;
  email: string;
  name: string;
  initials: string;
  color: string;
  bg: string;
  roomId?: string;
}): Promise<boolean> {
  const { error } = await supabase.from('user_profiles').insert({
    id: params.id,
    email: params.email,
    name: params.name,
    initials: params.initials,
    color: params.color,
    bg: params.bg,
    room_id: params.roomId ?? `${params.id}-main`,
  });
  if (error) console.error('[supabase] createProfile error:', error.message);
  return !error;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    initials: data.initials,
    color: data.color,
    bg: data.bg,
    roomId: data.room_id,
    partnerId: data.partner_id,
    photoUrl: data.photo_url,
  };
}

export async function updateProfile(
  userId: string,
  params: Partial<Pick<UserProfile, 'name' | 'initials' | 'color' | 'bg' | 'photoUrl'>>,
): Promise<boolean> {
  const update: Record<string, string> = {};
  if (params.name)                      update.name       = params.name;
  if (params.initials)                  update.initials   = params.initials;
  if (params.color)                     update.color      = params.color;
  if (params.bg)                        update.bg         = params.bg;
  if (params.photoUrl !== undefined)    update.photo_url  = params.photoUrl ?? '';
  const { error } = await supabase.from('user_profiles').update(update).eq('id', userId);
  return !error;
}

// ── Partner invitations ───────────────────────────────────────────────────────

export async function findPartnerPreview(
  email: string,
): Promise<{ found: false } | { found: true; id: string; name: string; initials: string; color: string; bg: string }> {
  const { data, error } = await supabase.rpc('find_partner_preview', { p_email: email });
  if (error || !data) return { found: false };
  return data as { found: false } | { found: true; id: string; name: string; initials: string; color: string; bg: string };
}

export async function sendPartnerInvite(inviteeEmail: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const { error } = await supabase.from('partner_invitations').insert({
    inviter_id: session.user.id,
    invitee_email: inviteeEmail,
  });
  return !error;
}

export async function getPendingInvitation(myEmail: string) {
  const { data } = await supabase
    .from('partner_invitations')
    .select('*, inviter:user_profiles!inviter_id(name, initials, color, bg)')
    .eq('invitee_email', myEmail)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function acceptInvitation(
  invitationId: string,
): Promise<{ success: true; room_id: string } | { error: string }> {
  const { data, error } = await supabase.rpc('accept_partner_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) return { error: error.message };
  return data as { success: true; room_id: string } | { error: string };
}

export async function declineInvitation(invitationId: string): Promise<boolean> {
  const { error } = await supabase.rpc('decline_partner_invitation', {
    p_invitation_id: invitationId,
  });
  return !error;
}
```

---

## Cambios en `types/index.ts`

### Eliminar
```typescript
// Estas constantes desaparecen:
export const USERS: Record<string, UserData> = { ... }
export const ROOM_FOR_USER: Record<string, string> = { ... }
export const PARTNER: Record<string, string> = { ... }
```

### Añadir
```typescript
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  initials: string;
  color: string;
  bg: string;
  roomId: string | null;
  partnerId: string | null;
  photoUrl: string | null;
}

export interface PartnerInvitation {
  id: string;
  inviterId: string;
  inviterName: string;
  inviterInitials: string;
  inviterColor: string;
  inviterBg: string;
  inviteeEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}
```

---

## Cambios en `store/useAppStore.ts`

### Estado nuevo
```typescript
authProfile: UserProfile | null;   // perfil del usuario logueado
isAuthReady: boolean;              // true cuando ya se verificó si hay sesión
pendingInvitation: PartnerInvitation | null;
```

### `initialize()` actualizado
```
1. getSession()
2. Sin sesión → isAuthReady: true (navegación detecta y muestra /login)
3. Con sesión → getProfile(session.user.id)
4. Sin perfil → isAuthReady: true (navegación detecta y muestra /onboarding)
5. Con perfil:
   a. authProfile = perfil
   b. currentUser = profile.id
   c. users = { [profile.id]: { name, initials, color, bg, photo } }
   d. _connectToRoom(profile.roomId ?? `${profile.id}-main`)
   e. getPendingInvitation(profile.email) → pendingInvitation si hay
   f. isAuthReady: true
6. onAuthStateChange → al SIGNED_OUT: limpiar authProfile, payload, desconectar
```

### Nuevas acciones
```typescript
logout: async () => {
  await signOut();
  _channel && await unsubscribeFromRoom(_channel);
  _channel = null;
  _payloadReady = false;
  set({ authProfile: null, payload: emptyPayload(), pendingInvitation: null, isAuthReady: true });
}

completePartnerPairing: async (roomId: string) => {
  // Actualiza authProfile.roomId, reconecta al room compartido
  const { authProfile } = get();
  if (!authProfile) return;
  set({ authProfile: { ...authProfile, roomId } });
  await _connectToRoom(authProfile.id as UserId);
}
```

### Eliminar
- `USERS`, `ROOM_FOR_USER`, `PARTNER` del estado inicial (inicial vacío: `users: {}`)
- `seedDemoData()`
- `_syncCustomUsersToCloud()` y la sync con `global-users` room

---

## Pantallas de autenticación

### `app/login.tsx`
- Logo + "Bienvenido a Nosotros"
- Campo email (`keyboardType="email-address"`)
- Campo contraseña (`secureTextEntry`)
- Botón "Iniciar sesión" → `signIn()` → éxito: store navega solo
- Separador "— o —"
- Botón "Continuar con Google" → `signInWithGoogle(redirectTo)`
- Link "¿No tienes cuenta? Crear una" → `/register`
- Errores en español (email incorrecto, contraseña incorrecta, etc.)

### `app/register.tsx`
- Campo nombre completo
- Campo email
- Campo contraseña (≥8 caracteres)
- Campo confirmar contraseña
- Botón "Crear cuenta" → `signUp()` → navega a `/verify?email=...&name=...`
- Separador "— o —"
- Botón "Continuar con Google" → `signInWithGoogle()` (salta OTP, va a `/onboarding`)
- Link "¿Ya tienes cuenta? Inicia sesión" → `/login`

### `app/verify.tsx`
- Recibe `email` y `name` por query params
- "Revisá tu correo" + email destacado
- "Te enviamos un código de 6 dígitos"
- 6 inputs individuales (un dígito cada uno, auto-focus al siguiente, auto-submit al llenar el último)
- Botón "Verificar" → `verifyOtp(email, token)` → éxito: navega a `/onboarding?name=...`
- "¿No llegó? Reenviar código" (cooldown de 60 segundos) → llama `signUp()` de nuevo

### `app/_layout.tsx` — guard reactivo
```tsx
const isAuthReady  = useAppStore(s => s.isAuthReady);
const authProfile  = useAppStore(s => s.authProfile);

// Si !isAuthReady → pantalla de carga/splash
// Si isAuthReady && !authProfile → Stack solo con login/register/verify/onboarding
// Si isAuthReady && authProfile → Stack normal con (tabs) + perfil
```

---

## Cambios en `app/perfil.tsx`

### Eliminar
- Lista de usuarios con opción de cambiar entre ellos
- Formulario "Agregar usuario"
- Botón "Crear perfil de demo" / `seedDemoData()`

### Añadir
- **Sección Cuenta**: muestra email real + botón "Cerrar sesión" con confirmación → `store.logout()`
- **Sección Mi pareja**:
  - Si `authProfile.partnerId` → muestra nombre e iniciales del partner
  - Si no → campo email + botón "Invitar pareja" → `sendPartnerInvite(email)`
- **Banner invitación pendiente**: si hay `pendingInvitation` → botones Aceptar / Rechazar

### Mantener
- Upload de foto (guarda URL en `user_profiles.photo_url` vía `updateProfile()`)
- Selector de moneda y tema

---

## Paquetes necesarios

- `expo-web-browser` — para el flujo OAuth de Google en móvil (probablemente ya instalado)
- `expo-linking` — para recibir el callback de OAuth (probablemente ya instalado)
- No se necesitan paquetes adicionales

---

## Verificación end-to-end

1. **Registro + OTP**: Crear cuenta → recibir email con código de 6 dígitos → ingresar → entra a onboarding
2. **Login Google**: Tocar "Continuar con Google" → ventana OAuth → vuelve a la app → entra a onboarding (o tabs si ya tiene perfil)
3. **Sesión persistente**: Cerrar y abrir app → entra directamente sin login
4. **Logout**: Cerrar sesión → app muestra login → datos locales limpios
5. **Invitación**: A invita a B@email.com → B se registra → al terminar onboarding ve modal → acepta → ambos comparten datos en Realtime
6. **Datos**: Los movimientos, categorías, ahorros siguen funcionando exactamente igual
