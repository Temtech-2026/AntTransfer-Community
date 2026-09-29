/** Textes de la page de gestion des partages et de la fenêtre de création de partage externe. */
export default {
  /* ============================ Page ============================ */
  'shares.page.title': 'Gestion des partages',
  'shares.page.subtitle':
    "Liens de partage externe que j'ai créés ; le code d'extraction n'est jamais réaffiché et la révocation est irréversible",
  'shares.denied':
    "Le compte actuel ne dispose pas de l'autorisation de partage externe (file:share) ; contactez un administrateur pour l'activer",
  'shares.table.title': 'Mes partages',

  /* ============================ Actions ============================ */
  'shares.action.create': 'Créer un partage',
  'shares.action.copy': 'Copier le lien',
  'shares.action.revoke': 'Révoquer le partage',

  /* ============================ Copie ============================ */
  'shares.copy.success':
    "Lien copié ; le code d'extraction n'est jamais réaffiché, utilisez celui défini à la création",
  'shares.copy.manualTitle': 'Veuillez copier le lien manuellement',
  'shares.copy.disabled': 'Seuls les partages en vigueur peuvent être copiés',

  /* ============================ Révocation ============================ */
  'shares.revoke.success':
    'Partage révoqué, le lien est immédiatement invalidé',
  'shares.revoke.confirmTitle': 'Révoquer ce lien de partage ?',
  'shares.revoke.confirmContent':
    "Après la révocation, le lien est immédiatement invalidé et le code d'extraction déjà transmis devient caduc. Pour un nouvel envoi externe, il faut créer un nouveau partage et générer un nouveau lien.",
  'shares.revoke.confirmOk': 'Confirmer la révocation',

  /* ==================== Révocation par lots (cases de ligne / tout en un clic) ==================== */
  'shares.action.revokeSelected': 'Révoquer la sélection',
  'shares.action.revokeSelectedCount': 'Révoquer la sélection ({count})',
  'shares.action.revokeAll': 'Tout révoquer',
  'shares.revokeBatch.success': '{count} liens de partage révoqués',
  'shares.revoke.none': 'Aucun lien de partage en vigueur',
  'shares.revokeSelected.confirmTitle':
    'Révoquer les {count} partages sélectionnés ?',
  'shares.revokeSelected.confirmContent':
    "Les liens sélectionnés sont immédiatement révoqués et les codes d'extraction déjà transmis deviennent caducs. La révocation est définitive et irréversible.",
  'shares.revokeSelected.confirmOk': 'Confirmer la révocation',
  'shares.revokeAll.confirmTitle': 'Révoquer tous les partages en vigueur ?',
  'shares.revokeAll.confirmContent':
    "Tous les liens « en vigueur » du compte actuel (au-delà de cette page) seront révoqués ; les liens et codes d'extraction déjà transmis deviendront immédiatement caducs. La révocation est définitive et irréversible.",
  'shares.revokeAll.confirmOk': 'Confirmer la révocation totale',
  /* ============================ Création réussie ============================ */
  'shares.created.title': 'Partage créé',
  'shares.created.ok': "J'ai compris",
  'shares.created.code': "Code d'extraction : ",
  'shares.created.note':
    "Le serveur ne conserve que l'empreinte du code d'extraction ; il ne sera plus consultable après la fermeture de cette fenêtre. Transmettez-le immédiatement au destinataire.",

  /* ============================ Colonnes du tableau ============================ */
  'shares.column.deletedFile': '(fichier supprimé)',
  'shares.column.status': 'État',
  'shares.column.expireAt': "Valable jusqu'au",
  'shares.column.used': 'Utilisations',
  'shares.column.unlimited': 'Illimité',
  'shares.column.remaining': 'Utilisations restantes',
  'shares.column.extractCode': "Code d'extraction",
  'shares.column.extractOn': 'Activé',
  'shares.column.extractOff': 'Désactivé',
  'shares.column.createTime': 'Date de création',

  /* ============================ Fenêtre de création ============================ */
  'shares.create.title': 'Créer un partage externe',
  'shares.create.file': 'Fichier à partager',
  'shares.create.filePlaceholder': 'Saisir un nom de fichier pour rechercher',
  'shares.create.fileRequired': 'Veuillez sélectionner le fichier à partager',
  'shares.create.fileNotFound': 'Aucun fichier correspondant',
  'shares.create.expire': 'Validité',
  'shares.create.expireRequired': 'Veuillez choisir la durée de validité',
  'shares.create.expireExtra':
    '{days} jours maximum ; le lien expire automatiquement à échéance',
  'shares.create.downloadLimit': 'Limite de téléchargements',
  'shares.create.downloadLimitRequired':
    'Veuillez saisir la limite de téléchargements',
  'shares.create.downloadLimitExtra':
    'de 1 à {max} ; le lien expire automatiquement une fois la limite atteinte',
  'shares.create.extractCode': "Code d'extraction",
  'shares.create.extractCodeRequired': "Veuillez saisir le code d'extraction",
  'shares.create.extractCodeRule':
    "Le code d'extraction doit comporter de {min} à {max} lettres ou chiffres",
  'shares.create.extractCodeExtra':
    "Le serveur ne conserve que l'empreinte ; transmettez-le immédiatement au destinataire après la création, il ne sera plus consultable ensuite",

  /* ==================== Page de récupération par le visiteur (/share/:token, sans connexion) ==================== */
  'shares.visit.subtitle':
    "Quelqu'un vous a envoyé des fichiers via AntTransfer ; saisissez le code d'extraction pour les récupérer",
  'shares.visit.invalidLink':
    'Lien incomplet : le jeton de partage est absent ; vérifiez que le lien copié est complet',
  'shares.visit.code.label': "Code d'extraction",
  'shares.visit.code.placeholder':
    "Saisissez le code d'extraction reçu par e-mail ou par messagerie",
  'shares.visit.code.prefilled':
    "Le code d'extraction du lien a été prérempli ; confirmez puis cliquez sur « Récupérer les fichiers »",
  'shares.visit.code.required': "Veuillez saisir le code d'extraction",
  'shares.visit.submit': 'Récupérer les fichiers',
  'shares.visit.redeemed':
    'Récupération réussie ; cliquez sur le bouton ci-dessous pour télécharger',
  'shares.visit.ticketTtl':
    "L'adresse de téléchargement est valide {minutes} minutes ; après expiration, il faut récupérer à nouveau, ce qui décompte une utilisation supplémentaire",
  'shares.visit.unknownFile': '(nom de fichier indisponible)',
  'shares.visit.download': 'Télécharger le fichier',
  'shares.visit.footer':
    "Seule une personne disposant du code d'extraction peut récupérer les fichiers ; ne transmettez pas le lien à des tiers",
} as const;
