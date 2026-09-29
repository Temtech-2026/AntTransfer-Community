/** Textes de la carte des autorisations (matrice ressource × sujet / chronologie des autorisations). */
export default {
  /* ============================ Structure de la page ============================ */
  'permissionMap.page.title': 'Carte des autorisations',
  'permissionMap.page.subTitle':
    "Mes points d'autorisation, leur origine et leur validité",
  'permissionMap.loadFailed':
    'Échec du chargement de la carte des autorisations',

  /* ============================ Cartes d'aperçu ============================ */
  'permissionMap.stat.perm.title': "Points d'autorisation",
  'permissionMap.stat.perm.footer':
    'Le serveur indique uniquement « détenu ou non »',
  'permissionMap.stat.role.title': 'Rôles',
  'permissionMap.stat.role.footer':
    "L'une des origines connues des points d'autorisation",
  'permissionMap.stat.grant.title': 'Autorisations par approbation',
  'permissionMap.stat.grant.footer': 'dont {expired} expirées',
  'permissionMap.stat.expiring.footer': 'expire sous 7 jours',

  /* ============================ Aperçu des autorisations ============================ */
  'permissionMap.overview.title': 'Aperçu des autorisations',
  'permissionMap.overview.subTitle':
    "Utilisateur, périmètre de données et points d'autorisation",
  'permissionMap.overview.userId': 'ID utilisateur',
  'permissionMap.overview.dataScope': 'Périmètre de données',
  'permissionMap.overview.roles': 'Rôles',
  'permissionMap.overview.grants': 'Autorisations par approbation',
  'permissionMap.grant.total': '{total} au total',
  'permissionMap.grant.expiringSuffix': '{count} arrivent bientôt à expiration',
  'permissionMap.grant.expiredSuffix': '{count} expirées',
  'permissionMap.permCodes.title': "Points d'autorisation ({count})",
  'permissionMap.permCodes.desc':
    "Le serveur indique uniquement « détenu ou non » ; l'origine de chaque point nécessitera une future API. Les rôles et les autorisations par approbation ci-dessous constituent deux origines connues.",
  'permissionMap.permCodes.empty': "Aucun point d'autorisation",

  /* ============================ Table des origines d'autorisation ============================ */
  'permissionMap.grants.title': 'Origine des autorisations',
  'permissionMap.grants.subTitle':
    '{count} autorisations par approbation au total',
  'permissionMap.grants.empty': 'Aucune autorisation par approbation',
  'permissionMap.column.source': 'Origine',
  'permissionMap.column.grantType': "Action d'autorisation",
  'permissionMap.column.resource': 'Ressource',
  'permissionMap.column.application': "Demande d'origine",
  'permissionMap.column.expireAt': "Date d'expiration",
  'permissionMap.column.validity': 'État de validité',
  'permissionMap.source.approval': 'Autorisation par approbation',

  /* ============================ Chronologie des validités ============================ */
  'permissionMap.timeline.title': 'Chronologie des validités',
  'permissionMap.timeline.subTitle':
    "Axe des expirations : l'autorisation prend effet dès son enregistrement",
  'permissionMap.timeline.expirePrefix': 'Expire le',
  'permissionMap.timeline.fromApplication': "Demande d'origine n° {id}",
  'permissionMap.timeline.empty': "Aucune autorisation avec date d'expiration",

  /* ============================ Répartition des états d'autorisation (visualisation) ============================ */
  'permissionMap.distribution.title': "Répartition des états d'autorisation",
  'permissionMap.distribution.subTitle':
    '{count} autorisations par approbation, regroupées par état de validité',
  'permissionMap.distribution.empty':
    'Aucune autorisation par approbation ; la répartition ne peut pas être affichée',
  'permissionMap.distribution.percent': '{percent}%',
  'permissionMap.validity.barTip':
    'Encore {days} jours ; la longueur de la barre est une échelle visuelle plafonnée à {horizon} jours (le serveur ne transmet pas la date de début, la « proportion consommée » ne peut donc pas être affichée)',

  /* ============================ État d'autorisation et jours restants ============================ */
  'permissionMap.grantState.active': 'En vigueur',
  'permissionMap.grantState.expiring': 'Expire bientôt',
  'permissionMap.grantState.expired': 'Expirée',
  'permissionMap.grantState.permanent': 'Valable à long terme',
  'permissionMap.remainDays': 'Encore {days} jours',

  /* ============================ Répartition des domaines d'autorisation (regroupement côté client par préfixe) ============================ */
  'permissionMap.permCodes.domainTitle':
    "Répartition des domaines d'autorisation",
  'permissionMap.permCodes.domainDesc':
    "Regroupement côté client selon le préfixe `:` des points d'autorisation (le serveur ne possède pas de champ « domaine ») ; la longueur des barres est relative au groupe le plus nombreux.",
  'permissionMap.permCodes.domainOther': 'Autres',
  'permissionMap.permCodes.domainCount': '{count}',
} as const;
