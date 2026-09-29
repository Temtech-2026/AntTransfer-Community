/** Textes du centre de messages (notifications système + tâches à faire). */
export default {
  'message.title': 'Centre de messages',
  'message.subtitle':
    'Les approbations à traiter, les partages et les alertes de sécurité sont regroupés ici en temps réel',
  'message.tab.notifications': 'Notifications système',
  'message.tab.todos': 'À faire',
  'message.unread.badge': 'Non lus : {count}',
  'message.unread.inbox': 'Notifications système non lues : {count}',
  'message.unread.todo': 'Tâches à traiter : {count}',

  'message.action.refresh': 'Actualiser',
  'message.action.markAllRead': 'Tout marquer comme lu',
  'message.action.markRead': 'Marquer comme lu',
  'message.action.markedRead': 'Marqué comme lu',
  'message.action.allMarkedRead': '{count} notifications marquées comme lues',
  'message.action.allReadNoop': 'Aucune notification non lue',
  'message.action.jump': 'Traiter',
  'message.action.markHandled': 'Marquer comme traité',
  'message.action.handled': 'Marqué comme traité',

  'message.state.new': 'Nouveau',
  'message.state.unread': 'Non lu',
  'message.state.read': 'Lu',

  'message.connection.connecting':
    'Établissement de la connexion en temps réel…',
  'message.connection.reconnecting':
    'Connexion en temps réel interrompue, reconnexion automatique…',
  'message.connection.closed':
    'Connexion en temps réel fermée ; les nouveaux messages arriveront en différé',
  'message.connection.reconnectNow': 'Reconnecter maintenant',
  'message.connection.restored': 'Connexion en temps réel rétablie',
  'message.connection.backfilled': '{count} messages hors ligne récupérés',
  'message.connection.offlineHint':
    'Les messages reçus pendant la déconnexion sont récupérés automatiquement à la reconnexion',

  'message.empty.title': 'Aucun message',
  'message.empty.desc':
    'Les approbations, partages et alertes de sécurité apparaissent ici en temps réel',
  'message.empty.filteredTitle': 'Aucun message non lu',
  'message.empty.filteredDesc':
    'Basculez sur « Tous » pour revoir les notifications précédentes',

  'message.todo.filter.pending': 'À traiter',
  'message.todo.filter.done': 'Traités',
  'message.todo.filter.all': 'Tous',
  'message.todo.empty.title': 'Aucune tâche à faire',
  'message.todo.empty.desc':
    'Aucune approbation ou alerte à traiter pour le moment',
  'message.todo.empty.doneTitle': "Aucun élément traité pour l'instant",
  'message.todo.empty.doneDesc': 'Les tâches traitées sont archivées ici',
  'message.todo.source.approval': 'À approuver par moi',
  'message.todo.source.approvalResult': "Résultat d'approbation",
  'message.todo.source.transfer': 'Transfert terminé',
  'message.todo.jumpMissing':
    "La page correspondante n'est pas encore disponible ; consultez d'abord le centre d'approbation",

  'message.type.1': 'À approuver par moi',
  'message.type.2': "Résultat d'approbation",
  'message.type.3': 'Lien verrouillé',
  'message.type.4': 'Lien bientôt expiré',
  'message.type.5': 'Alerte de sécurité',
  'message.type.8': 'Transfert terminé',
  'message.type.9': 'Fichier récupéré',
  'message.type.unknown': 'Notification système',
} as const;
