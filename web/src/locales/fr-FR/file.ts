/**
 * Textes du domaine des fichiers : espace de travail / liste / grille / corbeille / aperçu / partage externe / déplacement / demande d'autorisation / fenêtre de téléversement.
 *
 * <p>Les fonctions de présentation de `services/file` ne renvoient que des id (pour rester des fonctions pures et testables) ;
 * tous les textes réels sont ici, afin d'éviter de réécrire la même phrase dans la couche service et dans les composants.</p>
 */
export default {
  /* ============================ Niveau de confidentialité ============================ */
  'file.level.public': 'Public',
  'file.level.internal': 'Interne',
  'file.level.classified': 'Confidentiel',
  'file.level.unknown': 'Non classé',
  'file.level.applyHint.classified':
    "Ce fichier est confidentiel : la demande suivra une approbation à plusieurs niveaux et n'accordera ni téléchargement ni partage externe ; seul un aperçu temporaire sera ouvert si nécessaire.",
  'file.level.applyHint.internal':
    "Ce fichier est interne : la demande n'accorde par défaut que l'aperçu et le téléchargement ; le partage externe nécessite une approbation distincte.",
  'file.level.applyHint.public':
    "Ce fichier est public : l'approbation est plus rapide, mais un objet d'utilisation réel reste requis.",
  'file.level.applyHint.unknown':
    "Ce fichier n'est pas encore classé : l'approbateur pourra exiger un classement au préalable.",

  /* ============================ Badges de sécurité ============================ */
  'file.security.classified.label': 'Confidentiel',
  'file.security.classified.hint':
    'Confidentiel : aperçu avec filigrane, traçabilité de bout en bout des téléchargements et approbation obligatoire avant tout partage externe',
  'file.security.watermark.label': 'Filigrane',
  'file.security.watermark.hint':
    "Les aperçus et téléchargements sont recouverts d'un filigrane dynamique (compte et horodatage) permettant de remonter à l'origine d'une fuite",
  'file.security.expiring.label': 'Expire dans {days} jours',
  'file.security.expiring.hint':
    "Cet élément expirera dans {days} jours ; le lien et l'autorisation deviendront alors caducs",
  'file.security.expired.label': 'Expiré',
  'file.security.expired.hint':
    "Cet élément a dépassé sa date d'expiration ; pour continuer à l'utiliser, soumettez une nouvelle demande d'autorisation",

  /* ============================ Groupes par extension ============================ */
  'file.extGroup.doc': 'Documents',
  'file.extGroup.image': 'Images',
  'file.extGroup.video': 'Vidéos',
  'file.extGroup.audio': 'Audio',
  'file.extGroup.archive': 'Archives',

  /* ============================ État du partage ============================ */
  'file.shareStatus.active': 'En vigueur',
  'file.shareStatus.revoked': 'Révoqué',
  'file.shareStatus.expired': 'Expiré',
  'file.shareStatus.unknown': 'Inconnu',

  /* ============================ Types de demande d'autorisation ============================ */
  'file.applyType.access.label': 'Accès (aperçu)',
  'file.applyType.access.hint':
    'Aperçu en ligne uniquement, sans téléchargement ni partage externe',
  'file.applyType.download.label': 'Téléchargement',
  'file.applyType.download.hint':
    "Permet de télécharger l'original ; l'usage est tracé",
  'file.applyType.edit.label': 'Modification',
  'file.applyType.edit.hint':
    'Permet de renommer / déplacer / ajouter des versions',
  'file.applyType.share.label': 'Partage externe',
  'file.applyType.share.hint':
    'Permet de créer des liens de partage externe ; risque le plus élevé',

  /* ============================ Actions ============================ */
  'file.action.preview': 'Aperçu',
  'file.action.download': 'Télécharger',
  'file.action.share': 'Partager',
  'file.action.sendToChat': 'Envoyer vers la messagerie',
  'file.action.applyPerm': 'Demander une autorisation',
  'file.action.delete': 'Supprimer',
  'file.action.restore': 'Restaurer',
  'file.action.destroy': 'Détruire définitivement',
  'file.action.move': 'Déplacer',
  'file.action.recycle': 'Mettre à la corbeille',
  'file.action.clearSelection': 'Désélectionner',
  'file.action.more': 'Plus',
  'file.action.upload': 'Téléverser des fichiers',
  'file.action.enterRecycle': 'Corbeille',
  'file.action.backToFiles': 'Retour à mes fichiers',
  'file.action.emptyRecycle': 'Vider la corbeille',
  'file.action.permission': 'Autorisations',
  'file.action.refresh': 'Actualiser',
  /* ============================ Structure de la page ============================ */
  'file.title': 'Fichiers',
  'file.subtitle': 'Dossiers, niveau de confidentialité et filtres par type',
  'file.section.myFiles': 'Mes fichiers',
  'file.section.recycle': 'Corbeille',
  'file.breadcrumb.all': 'Tous les fichiers',
  'file.folder.children': 'Sous-dossiers : ',
  'file.folder.empty': 'Aucun sous-dossier dans ce dossier',
  'file.folder.root': 'Tous les fichiers (racine)',

  /* ============================ Colonnes du tableau ============================ */
  'file.column.name': 'Nom du fichier',
  'file.column.ext': 'Type',
  'file.column.level': 'Niveau de confidentialité',
  'file.column.size': 'Taille',
  'file.column.updateTime': 'Date de modification',
  'file.column.recycleTime': 'Mise à la corbeille',
  'file.column.action': 'Actions',
  'file.recycle.today': "Aujourd'hui",
  'file.recycle.daysAgo': 'Depuis {days} jours',

  /* ============================ Recherche et affichage ============================ */
  'file.query.name': 'Nom du fichier',
  'file.query.namePlaceholder': 'Mot-clé du nom de fichier',
  'file.query.ext': 'Type',
  'file.query.extAll': 'Tous les types',
  'file.query.level': 'Niveau de confidentialité',
  'file.query.levelAll': 'Tous les niveaux',
  'file.query.createTime': 'Date de création',
  'file.query.submit': 'Rechercher',
  'file.query.reset': 'Réinitialiser',
  'file.view.list': 'Liste',
  'file.view.grid': 'Grille',
  'file.total': '{total} éléments au total',
  'file.selectedCount': '{count} éléments sélectionnés',
  'file.uploadingCount': '{count} en téléversement',
  'file.grid.emptyRecycle': 'La corbeille est vide',
  'file.grid.emptyFolder':
    "Ce dossier ne contient encore aucun fichier ; téléversez-en ou créez d'abord un sous-dossier",
  /* ============================ Téléchargement ============================ */
  'file.download.preparing': 'Préparation du téléchargement de {name}',
  'file.download.done':
    'Le téléchargement de {name} a commencé ; consultez la liste de téléchargements du navigateur',
  'file.download.failed': 'Échec du téléchargement',

  /* ============================ Corbeille et destruction ============================ */
  'file.recycle.confirmTitle': 'Mettre « {name} » à la corbeille ?',
  'file.recycle.confirmContent':
    "Une fois à la corbeille, l'élément n'apparaît plus dans « Mes fichiers », mais peut être restauré à tout moment, sans perte de données.",
  'file.destroy.confirmTitle': 'Détruire définitivement « {name} » ?',
  'file.destroy.confirmContent':
    "L'entité du fichier et tous ses segments seront supprimés définitivement ; la corbeille ne les conservera plus. Cette opération est irréversible.",
  'file.restore.done': '« {name} » restauré',
  'file.empty.confirmTitle': 'Vider la corbeille ?',
  'file.empty.confirmContent':
    "Tous les fichiers de la corbeille seront détruits définitivement, sans récupération possible. Si vous n'en avez besoin que temporairement, mieux vaut les laisser dans la corbeille.",
  'file.empty.done': '{count} éléments détruits',
  'file.empty.noop': 'La corbeille était déjà vide',
  'file.batchRecycle.confirmTitle':
    'Mettre les {count} éléments sélectionnés à la corbeille ?',
  'file.batchRecycle.confirmContent':
    "Une fois à la corbeille, ils n'apparaissent plus dans « Mes fichiers », mais peuvent être restaurés à tout moment, sans perte de données.",
  'file.batchRecycle.done': '{count} éléments mis à la corbeille',
  'file.batchRecycle.noop': "Aucun élément n'a été mis à la corbeille",
  'file.recycle.alertTitle': 'Corbeille',
  'file.recycle.alertDescription':
    "Les fichiers de la corbeille n'apparaissent plus dans « Mes fichiers ». Vous pouvez les restaurer ici ou les détruire définitivement (irréversible) ; la destruction nécessite l'autorisation file:destroy.",
  'file.recycle.noFilterHint':
    "La corbeille ne prend pas en charge le filtrage par mot-clé ni par niveau de confidentialité : ses éléments sont sortis de l'arborescence et les résultats de filtre prêteraient à confusion",
  'file.batch.shareMultiHint':
    "Un seul lien de partage externe peut être généré à la fois ; ne cochez qu'un seul élément",
  'file.batch.applyMultiHint':
    "Une demande d'autorisation ne porte que sur un seul élément ; ne cochez qu'un seul élément",

  /* ============================ Aperçu ============================ */
  'file.preview.title': 'Aperçu',
  'file.preview.strategy.text': 'Texte',
  'file.preview.strategy.pdf': 'PDF',
  'file.preview.strategy.image': 'Image',
  'file.preview.strategy.downloadOnly': 'Téléchargement uniquement',
  'file.preview.strategy.none': 'Non pris en charge',
  'file.preview.failedTitle': "Échec de l'aperçu",
  'file.preview.loadFailed': "Échec du chargement des informations d'aperçu",
  'file.preview.empty': "Aucun contenu d'aperçu",
  'file.preview.truncated':
    'Contenu long : seuls les premiers caractères sont affichés ; téléchargez le fichier pour le consulter en entier',
  'file.preview.downloadOnlyTitle':
    "Ce type ne prend pas en charge l'aperçu en ligne",
  'file.preview.downloadOnlyDescription':
    "Pour réduire le risque de fuite, ce format n'est pas transcodé côté serveur ; téléchargez-le puis ouvrez-le en local.",
  'file.preview.downloadFile': 'Télécharger le fichier',
  'file.preview.unavailableTitle': 'Aperçu impossible',
  'file.preview.unavailableDescription':
    "Le serveur ne fournit aucune méthode d'aperçu disponible ; le format est peut-être non pris en charge ou la capacité d'aperçu n'est pas activée.",

  /* ============================ Déplacement ============================ */
  'file.move.title': 'Déplacer vers',
  'file.move.ok': 'Déplacer',
  'file.move.alertTitle': "Le déplacement ne change que l'emplacement",
  'file.move.alertDescription':
    "Le niveau de confidentialité, les liens de partage et les autorisations déjà accordées ne changent pas lors d'un déplacement.",
  'file.move.placeholder': 'Choisir le dossier de destination',
  'file.move.pending': '{count} éléments à déplacer',
  'file.move.pendingNames': ' : {names}',
  'file.move.etc': ' etc.',
  'file.move.unchanged':
    '(dont {count} éléments déjà dans le dossier de destination, qui seront ignorés)',
  'file.move.noop':
    "Le dossier de destination est identique à l'emplacement actuel ; aucun déplacement nécessaire",
  'file.move.done': '{count} éléments déplacés vers « {target} »',
  'file.move.failed': 'Échec du déplacement de {count} éléments : {names}',
  /* ============================ Demande d'autorisation ============================ */
  'file.apply.title': 'Demander une autorisation sur le fichier',
  'file.apply.submitFailed': "Échec de l'envoi de la demande",
  'file.apply.submittedTitle': 'Demande soumise',
  'file.apply.submittedSubTitle':
    'Numéro de demande : {no} ; suivez la progression dans « Mes demandes »',
  'file.apply.submittedExtra':
    "Une fois approuvée, l'autorisation prend effet automatiquement, sans nouvelle soumission ; en cas de rejet, consultez l'avis d'approbation, ajoutez des précisions puis soumettez à nouveau.",
  'file.apply.field.file': 'Fichier concerné',
  'file.apply.field.level': 'Niveau de confidentialité du fichier',
  'file.apply.levelAlertTitle':
    'Avertissement sur le niveau de confidentialité',
  'file.apply.field.applyType': "Type d'autorisation",
  'file.apply.field.applyTypeRequired':
    "Veuillez choisir le type d'autorisation",
  'file.apply.field.purpose': "Objet d'utilisation",
  'file.apply.field.purposeRequired': "Veuillez indiquer l'objet d'utilisation",
  'file.apply.field.purposeMin':
    "Saisissez au moins 10 caractères pour permettre à l'approbateur de juger",
  'file.apply.field.purposeMax': '500 caractères maximum',
  'file.apply.field.purposePlaceholder':
    "Par exemple : vérification des données du rapport d'analyse trimestrielle, usage strictement personnel, sans diffusion externe",
  'file.apply.field.expireAt': 'Validité souhaitée',
  'file.apply.field.expireAtExtra':
    "Laisser vide pour demander une autorisation à long terme (approbation plus difficile) ; remplissez selon le besoin réel, l'autorisation est révoquée automatiquement à expiration",
  'file.apply.field.expireAtPlaceholder': "Choisir la date d'expiration",
  'file.apply.footnote':
    "Après la soumission, l'identité du demandeur et la date de la demande sont enregistrées par le serveur ; il est impossible de faire une demande pour autrui.",
  'file.apply.submit': 'Soumettre la demande',
  /* ============================ Fenêtre de partage externe ============================ */
  'file.share.presetDays': '{days} jours',
  'file.share.title': 'Partage externe',
  'file.share.titleWithName': 'Partage externe : {name}',
  'file.share.createFailed': 'Échec de la création du partage externe',
  'file.share.missingFileId':
    "Ce fichier n'a pas d'ID de fichier physique ; impossible de créer un lien de partage externe. Actualisez puis réessayez",
  'file.share.copied': "Lien et code d'extraction copiés",
  'file.share.copyDenied':
    "Le navigateur a refusé l'accès au presse-papiers ; sélectionnez et copiez manuellement",
  'file.share.again': 'En créer un autre',
  'file.share.done': 'Terminer',
  'file.share.generate': 'Générer le lien',
  'file.share.resultTitle': 'Lien de partage externe généré',
  'file.share.resultSubTitle':
    "Le code d'extraction ne sera plus affiché ; copiez-le immédiatement et transmettez-le au destinataire",
  'file.share.field.url': 'Lien de partage',
  'file.share.field.code': "Code d'extraction",
  'file.share.field.expireAt': "Valable jusqu'au",
  'file.share.field.downloadLimit': 'Téléchargements autorisés',
  'file.share.times': '{count} fois',
  'file.share.copyBoth': "Copier le lien et le code d'extraction",
  'file.share.approvalRequiredTitle':
    "Fichier confidentiel : une approbation de l'administrateur est requise avant tout partage externe",
  'file.share.approvalRequiredDescription':
    "Le partage externe d'un fichier confidentiel suppose une « demande d'approbation à haut niveau de confidentialité approuvée » ; générer directement un lien sera refusé par le serveur (403 / 1003). Soumettez d'abord une demande d'autorisation pour ce fichier dans la liste, puis revenez ici une fois l'approbation obtenue.",
  'file.share.warningTitle':
    'Un lien de partage externe équivaut à faire sortir le fichier du réseau interne',
  'file.share.warningDescription':
    "Le lien permet un accès sans connexion avec le seul code d'extraction, et tous les téléchargements sont tracés ; les fichiers confidentiels nécessitent une approbation de partage externe préalable, faute de quoi le serveur les refusera (403 / 1003).",
  'file.share.block.audience': 'Qui peut accéder',
  'file.share.audience.link': 'Accès par lien',
  'file.share.audience.linkHint':
    "Toute personne possédant le lien et le code d'extraction peut consulter sans connexion, ce qui convient à l'envoi vers des partenaires externes ; aucune identification n'étant faite, ce mode convient mieux aux scénarios « ponctuels, à nombre de fois limité ».",
  'file.share.audience.member': 'Destinataires désignés',
  'file.share.audience.memberHint':
    "Autorisation précise par e-mail, numéro de téléphone ou organigramme, visible uniquement des personnes autorisées. Cela nécessite une API d'autorisation interne côté serveur, non fournie actuellement ; cette option n'est donc pas sélectionnable.",
  'file.share.block.policy': 'Autorisations et politique de sécurité',
  'file.share.field.codeLabel': "Mot de passe d'accès (code d'extraction)",
  'file.share.field.codeRequired': "Veuillez saisir le code d'extraction",
  'file.share.field.codeRule':
    "Le code d'extraction doit comporter de {min} à {max} lettres ou chiffres",
  'file.share.field.codeExtra':
    "Le serveur ne conserve que l'empreinte ; il ne sera plus affiché après la fermeture de la fenêtre. En cas d'oubli, il faut révoquer le lien et le recréer",
  'file.share.field.codePlaceholder': '6 à 32 lettres ou chiffres',
  'file.share.random': 'Aléatoire',
  'file.share.copy': 'Copier',
  'file.share.codeMissing':
    "Veuillez d'abord générer ou saisir le code d'extraction",
  'file.share.codeCopied': "Code d'extraction copié",
  'file.share.field.limitLabel': 'Limite de téléchargements',
  'file.share.field.limitRequired':
    'Veuillez saisir la limite de téléchargements',
  'file.share.field.limitExtra':
    'Une fois la limite atteinte, le lien expire automatiquement ; la révocation du lien invalide immédiatement les jetons de téléchargement déjà émis',
  'file.share.trace.label': 'Traçabilité complète des téléchargements',
  'file.share.trace.description':
    "Activé de force : chaque téléchargement enregistre le compte (IP et UA pour les visiteurs sans connexion), l'heure et le fichier, traçables dans le journal d'audit ; non désactivable.",
  'file.share.watermark.label': "Filigrane dynamique sur l'aperçu",
  'file.share.watermark.description':
    "Nécessite que le serveur fournisse l'interrupteur de filigrane et la capacité de rendu, non disponibles actuellement ; ne pas cocher ici signifie que le lien de partage externe de ce fichier n'a aucune protection par filigrane.",
  'file.share.block.expire': 'Validité',
  'file.share.field.expireLabel': 'Durée de validité du lien',
  'file.share.field.expireRequired': 'Veuillez choisir la durée de validité',
  'file.share.field.expireExtra':
    'Calculée comme « instant de génération + N jours », plafonnée à {max} jours ; au-delà, le serveur refusera',
};
