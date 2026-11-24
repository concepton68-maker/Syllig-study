import { AuthFrame } from '../AuthFrame';
import { ForgotForm } from './Form';

export const metadata = { title: 'Mot de passe oublié' };

export default function Forgot() {
  return (
    <AuthFrame title="Mot de passe oublié" sub="Indique ton identifiant (ou ton e-mail pour un compte parent). On prévient la bonne personne.">
      <ForgotForm />
    </AuthFrame>
  );
}
