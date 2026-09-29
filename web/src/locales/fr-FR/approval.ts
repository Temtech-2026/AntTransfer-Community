/** Textes du centre d'approbation (à traiter / traités / détail / décision). */
export default {
  // Page
  'approval.title': "Centre d'approbation",
  'approval.subtitle':
    "Approbations à traiter et demandes d'autorisation que j'ai initiées",
  'approval.tab.pending': 'À approuver par moi',
  'approval.tab.mine': 'Mes demandes',
  'approval.slaNotice':
    "Le SLA est calculé selon le niveau de confidentialité (public 24 h / interne 12 h / confidentiel 4 h) ; le dépassement est une simple alerte et n'entraîne ni validation ni octroi automatique de l'autorisation.",
  'approval.decisionSubmitted': "Résultat d'approbation envoyé",
  'approval.longTerm': 'Valable à long terme',

  // Colonnes de la liste
  'approval.column.applicationNo': 'Numéro de demande',
  'approval.column.applyAction': 'Action demandée',
  'approval.column.level': 'Niveau de confidentialité',
  'approval.column.resource': 'Ressource',
  'approval.column.applicant': 'Demandeur',
  'approval.column.purpose': "Objet d'utilisation",
  'approval.column.desiredExpireAt': 'Expiration souhaitée',
  'approval.column.sla': 'SLA',
  'approval.column.status': 'État',
  'approval.column.opinion': "Avis d'approbation",
  'approval.column.createdAt': 'Date de la demande',
  'approval.column.actions': 'Actions',

  // Actions en ligne
  'approval.rowAction.detail': 'Détail',
  'approval.rowAction.approve': 'Approuver',
  'approval.rowAction.reject': 'Rejeter',

  // États de la demande d'approbation
  'approval.status.pending': "En attente d'approbation",
  'approval.status.approved': 'Approuvée',
  'approval.status.rejected': 'Rejetée',
  'approval.status.transferred': 'Transférée',
  'approval.status.cancelled': 'Annulée',
  'approval.status.unknown': 'Inconnu',

  // Actions d'autorisation
  'approval.grantAction.access': 'Accès (aperçu)',
  'approval.grantAction.download': 'Téléchargement',
  'approval.grantAction.edit': 'Modification',
  'approval.grantAction.share': 'Partage externe',
  'approval.grantAction.unknown': 'Action inconnue',

  // SLA (compte à rebours et échéance)
  'approval.sla.noDeadline': '--',
  'approval.sla.overdue.days': 'Dépassement de {days} j {hours} h',
  'approval.sla.overdue.hours': 'Dépassement de {hours} h {minutes} min',
  'approval.sla.overdue.minutes': 'Dépassement de {minutes} min',
  'approval.sla.tooltip':
    "À traiter avant le {deadline} (le dépassement n'est qu'une alerte, aucun octroi automatique)",

  // Volet de détail
  'approval.detail.title': "Détail de la demande d'approbation",
  'approval.detail.slaDeadline': 'Échéance {deadline}',
  'approval.detail.timeline': 'Historique du circuit',
  'approval.timeline.submit': 'Demande soumise',
  'approval.timeline.purpose': 'Objet : {purpose}',
  'approval.timeline.approved': 'Approuvée',
  'approval.timeline.rejected': 'Rejetée',
  'approval.timeline.transferred': 'Transférée à un tiers',
  'approval.timeline.cancelled': 'Annulée par le demandeur',
  'approval.timeline.pending': "En attente d'approbation",
  // Fenêtre de décision
  'approval.modal.approveTitle': 'Approuver la demande',
  'approval.modal.rejectTitle': 'Rejeter la demande',
  'approval.modal.approveOk': "Confirmer l'approbation",
  'approval.modal.rejectOk': 'Confirmer le rejet',
  'approval.modal.applicationNo': 'Numéro de demande : {no}',
  'approval.modal.applyScope': 'Demande : {action}',
  'approval.modal.desiredExpireAt': 'Expiration souhaitée : {at}',
  'approval.modal.grantScope':
    "Périmètre d'autorisation (peut uniquement être resserré, sans dépasser la demande)",
  'approval.modal.grantScopeDownscoped':
    "Inférieur à l'action demandée « {action} » — l'autorisation sera accordée sur un périmètre plus restreint",
  'approval.modal.grantScopeSame': 'Identique au périmètre demandé',
  'approval.modal.grantScopePlaceholder': "Choisir l'action d'autorisation",
  'approval.modal.expireAt':
    "Validité de l'autorisation (peut uniquement être raccourcie, sans dépasser la valeur demandée)",
  'approval.modal.expireCapped':
    'La date choisie est postérieure à celle souhaitée par le demandeur ; elle sera ramenée à {expireAt}',
  'approval.modal.expireKeep': 'Laisser vide pour une validité à long terme',
  'approval.modal.expirePlaceholder': 'Vide = validité à long terme',
  'approval.modal.opinionApprove': "Avis d'approbation (facultatif)",
  'approval.modal.opinionReject': 'Motif du rejet (obligatoire)',
  'approval.modal.opinionMax': '{max} caractères maximum',
  'approval.modal.opinionRequired': 'Veuillez indiquer le motif du rejet',
  'approval.modal.opinionPlaceholderApprove':
    "Vous pouvez préciser les conditions d'autorisation",
  'approval.modal.opinionPlaceholderReject':
    'Indiquez le motif du rejet ; il sera transmis au demandeur',
  'approval.modal.notice':
    "Prise d'effet immédiate après validation : le périmètre et la durée d'autorisation ne peuvent pas être élargis ; tout élargissement exige une nouvelle demande du demandeur.",
  'approval.modal.approved': 'Demande approuvée',
  'approval.modal.rejected': 'Demande rejetée',
  'approval.modal.approveFailed': "Échec de l'approbation",
  'approval.modal.rejectFailed': 'Échec du rejet',
} as const;
