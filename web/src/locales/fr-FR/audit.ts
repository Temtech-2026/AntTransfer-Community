/** Textes du journal d'audit. */
export default {
  /* ============================ Structure de la page ============================ */
  'audit.page.title': "Journal d'audit",
  'audit.page.subTitle':
    "Recherche en lecture seule (les données sont anonymisées à l'écriture)",

  /* ============================ Accès refusé ============================ */
  'audit.denied.title': 'Réservé aux auditeurs',
  'audit.denied.subTitle':
    "Cette page nécessite le point d'autorisation audit:log:read, accordé uniquement au rôle d'auditeur.",

  /* ============================ Indice sur les critères de recherche ============================ */
  'audit.criteria.title': 'Critères de recherche',
  'audit.criteria.operatorPrefix':
    "L'opérateur est pris en charge uniquement par",
  'audit.criteria.operatorStrong': "correspondance exacte de l'ID utilisateur",
  'audit.criteria.operatorSuffix':
    ' (le serveur ne permet pas la recherche approximative par nom affiché) ;',
  'audit.criteria.timePrefix':
    "L'intervalle de temps est fermé et filtré selon l'heure de l'événement (",
  'audit.criteria.timeSuffix': ') ;',
  'audit.criteria.export':
    "L'export reprend les critères de recherche actuels ; la limite est contrôlée par le serveur.",

  /* ============================ Barre d'outils et messages ============================ */
  'audit.toolbar.export': 'Exporter en CSV',
  'audit.export.success': "Le téléchargement de l'export a commencé",

  /* ============================ Filtres ============================ */
  'audit.filter.all': 'Tous',
  'audit.filter.allActions': 'Toutes les actions',

  /* ============================ Colonnes ============================ */
  'audit.column.logTime': 'Heure',
  'audit.column.timeRange': 'Intervalle de temps',
  'audit.column.timeRangeStart': 'Début (inclus)',
  'audit.column.endTime': 'Heure de fin',
  'audit.column.timeRangeEnd': 'Fin (incluse)',
  'audit.column.operator': 'Opérateur',
  'audit.column.operatorIdPlaceholder':
    'ID utilisateur (correspondance exacte)',
  'audit.column.action': "Type d'action",
  'audit.column.module': 'Domaine',
  'audit.column.targetType': "Type d'objet",
  'audit.column.target': "Objet de l'opération",
  'audit.column.result': 'Résultat',
  'audit.column.ip': 'IP',
  'audit.column.traceId': 'ID de trace',
  'audit.column.detail': 'Détail',

  /* ============================ Résultat ============================ */
  'audit.result.success': 'Succès',
  'audit.result.failed': 'Échec',
  'audit.result.unknown': 'Inconnu',

  /* ============================ Repli pour l'opérateur ============================ */
  'audit.operator.deletedUser': 'Utilisateur supprimé n° {userId}',
  'audit.operator.system': 'Système / anonyme',
  /* ============================ Groupes d'actions ============================ */
  'audit.actionGroup.file': 'Fichiers et dossiers',
  'audit.actionGroup.share': 'Partage externe',
  'audit.actionGroup.userRole': 'Utilisateurs et rôles',
  'audit.actionGroup.approval': 'Approbation et autorisation',

  /* ============================ Noms d'action (miroir des constantes backend) ============================ */
  'audit.action.FILE_UPLOAD': 'Téléverser un fichier',
  'audit.action.FILE_DOWNLOAD': 'Télécharger un fichier',
  'audit.action.FILE_PREVIEW': 'Prévisualiser un fichier',
  'audit.action.FILE_RENAME': 'Renommer un fichier',
  'audit.action.FILE_MOVE': 'Déplacer un fichier',
  'audit.action.FILE_COPY': 'Copier un fichier',
  'audit.action.FILE_DELETE': 'Mettre à la corbeille',
  'audit.action.FILE_RESTORE': 'Restaurer depuis la corbeille',
  'audit.action.FILE_DESTROY': 'Détruire définitivement',
  'audit.action.RECYCLE_PURGE': 'Purge de la corbeille à expiration',
  'audit.action.FILE_TICKET_ISSUE': "Émission d'un jeton de téléchargement",
  'audit.action.FOLDER_CREATE': 'Créer un dossier',
  'audit.action.FOLDER_RENAME': 'Renommer un dossier',
  'audit.action.FOLDER_MOVE': 'Déplacer un dossier',
  'audit.action.FOLDER_DELETE': 'Supprimer un dossier',
  'audit.action.FILE_TAG': 'Ajouter / retirer une étiquette',
  'audit.action.VERSION_ROLLBACK': 'Restaurer une version précédente',
  'audit.action.VERSION_CREATE': 'Téléverser une nouvelle version',
  'audit.action.VERSION_PRUNE': 'Élagage des versions',
  'audit.action.PACK_CREATE': 'Lancer un archivage groupé',
  'audit.action.PACK_DOWNLOAD': "Télécharger l'archive produite",
  'audit.action.SHARE_CREATE': 'Créer un partage',
  'audit.action.SHARE_REVOKE': 'Révoquer un partage',
  'audit.action.SHARE_DOWNLOAD': 'Téléchargement par visiteur',
  'audit.action.SHARE_PREVIEW': 'Aperçu par visiteur',
  'audit.action.SHARE_BLOCKED': 'Blocage de partage externe',
  'audit.action.SHARE_CODE_LOCKED': "Verrouillage du code d'extraction",
  'audit.action.USER_CREATE': 'Créer un utilisateur',
  'audit.action.USER_UPDATE': 'Modifier un utilisateur',
  'audit.action.USER_DELETE': 'Supprimer un utilisateur',
  'audit.action.USER_STATUS': 'Activer / désactiver un utilisateur',
  'audit.action.USER_PASSWORD_RESET': 'Réinitialiser le mot de passe',
  'audit.action.USER_ROLE_ASSIGN': "Modifier les rôles de l'utilisateur",
  'audit.action.ROLE_CREATE': 'Créer un rôle',
  'audit.action.ROLE_UPDATE': 'Modifier un rôle',
  'audit.action.ROLE_DELETE': 'Supprimer un rôle',
  'audit.action.ROLE_PERM_ASSIGN': 'Ajuster les autorisations du rôle',
  'audit.action.APPLY': 'Soumettre une demande',
  'audit.action.APPROVE': 'Approuver',
  'audit.action.REJECT': 'Rejeter',
  'audit.action.TRANSFER': "Transférer l'approbation",
  'audit.action.GRANT': "Octroyer l'autorisation",
  'audit.action.REVOKE': "Révoquer l'autorisation",
  'audit.action.GRANT_EXPIRE': "Révoquer l'autorisation à l'expiration",
  /* ============================ Domaine ============================ */
  'audit.module.AUTH': 'Authentification',
  'audit.module.PERMISSION': 'Autorisations et administration système',
  'audit.module.TRANSFER': 'Transfert',
  'audit.module.FILE': 'Fichiers',
  'audit.module.COLLABORATION': 'Collaboration',
  'audit.module.COMMON': 'Commun',

  /* ============================ Type d'objet d'opération ============================ */
  'audit.target.SHARE': 'Lien de partage externe',
  'audit.target.FILE': 'Élément de fichier',
  'audit.target.FOLDER': 'Dossier',
  'audit.target.TAG': 'Étiquette',
  'audit.target.PACK_TASK': "Tâche d'archivage",
  'audit.target.USER': 'Compte utilisateur',
  'audit.target.ROLE': 'Rôle',
  'audit.target.PERMISSION': "Point d'autorisation",
  'audit.target.APPLICATION': "Demande d'autorisation",
  'audit.target.GRANT': "Enregistrement d'autorisation",
  'audit.target.SYSTEM': 'Tâche système',
} as const;
