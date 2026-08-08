import { isCloudMode, supabase } from './supabase'
import { assertInviteEmail } from './security'

export async function inviteTeamUser(email: string): Promise<void> {
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

  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: { email: normalized, redirectTo },
  })

  if (error) {
    throw new Error(error.message || 'No se pudo enviar la invitación')
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
}
