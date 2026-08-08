import { FunctionsHttpError } from '@supabase/supabase-js'
import { isCloudMode, supabase } from './supabase'
import { assertInviteEmail } from './security'
import { isSafeAuthRedirect } from './authLink'

async function messageFromFunctionsError(error: unknown, data: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body && typeof body === 'object' && 'error' in body && body.error) {
        return String(body.error)
      }
    } catch {
      // ignore parse errors
    }
  }
  if (data && typeof data === 'object' && 'error' in data && (data as { error: unknown }).error) {
    return String((data as { error: unknown }).error)
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'No se pudo enviar la invitación'
}

export async function inviteTeamUser(email: string): Promise<{ resent?: boolean }> {
  if (!isCloudMode || !supabase) {
    throw new Error('Las invitaciones solo están disponibles en modo nube')
  }

  const normalized = assertInviteEmail(email)
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session) {
    throw new Error('Tenés que iniciar sesión para invitar')
  }

  const baseUrl = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/?$/, '/')
  const redirectTo = `${baseUrl}?set-password=1`
  if (!isSafeAuthRedirect(redirectTo)) {
    throw new Error('URL de redirección inválida')
  }

  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: { email: normalized, redirectTo },
  })

  if (error) {
    throw new Error(await messageFromFunctionsError(error, data))
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }

  const mode =
    data && typeof data === 'object' && 'mode' in data ? String((data as { mode: unknown }).mode) : ''
  return { resent: mode === 'recovery_resent' }
}
