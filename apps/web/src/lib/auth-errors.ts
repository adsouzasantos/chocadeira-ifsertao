/** Traduz os códigos de erro do Supabase Auth para mensagens em português. */
export function authErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  switch (error?.code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail pelo link enviado antes de entrar.";
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com este e-mail.";
    case "weak_password":
      return "Senha fraca. Use pelo menos 8 caracteres, com letras e números.";
    case "same_password":
      return "A nova senha deve ser diferente da atual.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
    case "otp_expired":
      return "O link expirou. Solicite um novo.";
    case "session_not_found":
    case "refresh_token_not_found":
      return "Sua sessão expirou. Entre novamente.";
    default:
      return "Não foi possível concluir a operação. Tente novamente em instantes.";
  }
}
