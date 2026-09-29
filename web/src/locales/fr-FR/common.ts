/**
 * Textes génériques globaux (squelettes / états vides / confirmation d'action dangereuse / progression de téléversement).
 *
 * <p>Placés dans `locales` plutôt que dans les composants afin que les « composants d'expérience unifiée »
 * ne prennent pas de retard lors du changement de langue : ces composants sont réutilisés par toutes les
 * pages métier, et un seul texte codé en dur ferait fuiter le chinois dans l'interface française.
 */
export default {
  // États vides
  'common.empty.noData': 'Aucune donnée',
  'common.empty.noResult.title': 'Aucun résultat correspondant',
  'common.empty.noResult.desc':
    "Essayez d'ajuster les critères de filtre ou de vider les mots-clés puis relancez la recherche",
  'common.empty.error.title': 'Échec du chargement',
  'common.empty.error.desc':
    'Anomalie réseau ou de service. Réessayez plus tard',
  'common.empty.error.action': 'Recharger',
  'common.empty.denied.title': "Aucune autorisation d'accès",
  'common.empty.denied.desc':
    'Le compte actuel ne dispose pas de cette autorisation ; contactez un administrateur si nécessaire',

  // Double confirmation d'action dangereuse
  'common.danger.title': "Confirmez l'action",
  'common.danger.irreversible':
    'Cette action est irréversible. Confirmez avant de continuer.',
  'common.danger.ok': 'Exécuter',
  'common.danger.cancel': 'Annuler',

  // Actions et connecteurs réutilisés entre modules (évite de les réécrire dans chaque module et de faire fuiter le chinois dans l'interface française)
  'common.action.cancel': 'Annuler',
  'common.action.confirm': 'Confirmer',
  'common.action.ok': 'OK',
  'common.action.gotIt': 'Compris',
  'common.action.close': 'Fermer',
  'common.action.submit': 'Envoyer',
  'common.action.save': 'Enregistrer',
  'common.action.retry': 'Réessayer',
  'common.action.copy': 'Copier',
  'common.action.copied': 'Copié',
  'common.action.selectAll': 'Tout sélectionner',
  'common.action.clear': 'Vider',
  'common.action.refresh': 'Actualiser',
  'common.listSeparator': ', ',
  'common.etcCount': 'et {count} autres',

  // Progression globale du téléversement
  'common.upload.title': 'Tâches de téléversement',
  'common.upload.summary': '{active} en cours · {total} au total',
  'common.upload.idle': 'Aucun téléversement en cours',
  'common.upload.failed': '{count} en échec',
  'common.upload.percent': 'Progression globale {percent}%',
  'common.upload.openPage': 'Ouvrir la page de téléversement',
  'common.upload.viewQueue': 'Consulter',
  'common.upload.queue.default': 'Téléversement par segments',
  'common.upload.queue.file-workbench': 'Espace de travail des fichiers',
  // « Envoi d'un fichier local » dans la messagerie : la page et le volet utilisent chacun leur file
  // (voir l'en-tête de ChatAttachmentPicker ; un même id ferait s'entrecroiser les rappels de fin),
  // mais le nom de groupe désigne la même chose, le texte ne le distingue donc pas
  'common.upload.queue.chat-send': 'Envoi de fichier par messagerie',
  'common.upload.queue.chat-send-drawer': 'Envoi de fichier par messagerie',
  'common.upload.queue.unknown': 'Tâche de téléversement',
  'common.upload.status.working': 'Téléversement',
  'common.upload.status.paused': 'En pause',
  'common.upload.status.success': 'Terminé',
  'common.upload.status.error': 'Échec',
  'common.upload.status.canceled': 'Annulé',
  'common.upload.status.instant': 'Envoi instantané terminé',
} as const;
