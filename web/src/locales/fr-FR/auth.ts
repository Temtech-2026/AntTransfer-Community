/** Textes de la page de connexion. */
export default {
  /* ============================ Marque ============================ */
  'auth.login.brand.subtitle':
    "Plateforme d'entreprise pour le transfert et la collaboration de fichiers",

  /* ============================ Avertissement de verrouillage ============================ */
  'auth.login.locked.title': 'Compte verrouillé',
  'auth.login.locked.fallback': 'Trop de tentatives de connexion échouées',
  'auth.login.locked.desc': '{message} (encore {countdown})',

  /* ============================ Compte ============================ */
  'auth.login.username.label': 'Compte',
  'auth.login.username.placeholder': 'Saisissez votre compte',
  'auth.login.username.required': 'Veuillez saisir votre compte',

  /* ============================ Mot de passe ============================ */
  'auth.login.password.label': 'Mot de passe',
  'auth.login.password.placeholder': 'Saisissez votre mot de passe',
  'auth.login.password.required': 'Veuillez saisir votre mot de passe',

  /* ============================ Code de vérification visuel (réservé à l'interface) ============================ */
  'auth.login.captcha.label': 'Code de vérification visuel',
  'auth.login.captcha.tooltip':
    "Le service de code de vérification visuel n'est pas encore intégré ; la connexion actuelle ne le contrôle pas (réservé à l'interface)",
  'auth.login.captcha.placeholder': 'Activé après intégration du service',
  'auth.login.captcha.button': 'Code de vérification',

  /* ============================ Se souvenir de moi / Envoi ============================ */
  'auth.login.remember':
    'Se souvenir de moi (compte uniquement, mot de passe non enregistré)',
  'auth.login.submit': 'Se connecter',
  'auth.login.submitLocked': 'Réessayez dans {countdown}',

  /* ============================ Note de pied de page ============================ */
  'auth.login.footerHint':
    "Les comptes sont attribués par l'administrateur ; contactez-le pour toute demande d'ouverture",
} as const;
