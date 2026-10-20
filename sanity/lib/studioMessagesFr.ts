import { defineLocaleResourceBundle } from 'sanity';

/**
 * Les messages NATIFS de Sanity qui expliquent un blocage, réécrits en
 * français (2026-10-20). Le Studio reste en anglais (`en-US`) pour tout le
 * reste ; on ne surcharge que ce qui dit à l'auteur POURQUOI il ne peut pas
 * avancer : les messages de validation (sous chaque champ, dans le résumé en
 * tête du formulaire, dans l'infobulle de Publish) et les infobulles de
 * Publish quand il est grisé.
 *
 * `overwrite: true` : le bundle remplace les clés du bundle système de même
 * locale et de même espace de noms, au lieu de s'y ajouter.
 */

const validation = defineLocaleResourceBundle({
  locale: 'en-US',
  namespace: 'validation',
  overwrite: true,
  resources: {
    'array.exact-length': 'Exactement {{wantedLength}} éléments attendus.',
    'array.exact-length_blocks': 'Exactement {{wantedLength}} blocs attendus.',
    'array.item-duplicate': 'En double : cet élément figure déjà dans la liste.',
    'array.maximum-length': '{{maxLength}} éléments au plus.',
    'array.maximum-length_blocks': '{{maxLength}} blocs au plus.',
    'array.minimum-length': '{{minLength}} éléments au moins.',
    'array.minimum-length_blocks': '{{minLength}} blocs au moins.',
    'date.invalid-format': 'Date illisible : le format attendu est AAAA-MM-JJ.',
    'date.maximum': 'Au plus tard le {{maxDate}}.',
    'date.minimum': 'Au plus tôt le {{minDate}}.',
    'generic.incorrect-type': 'Valeur du mauvais type ({{actualType}} au lieu de {{expectedType}}) : la vider et la ressaisir.',
    'generic.not-allowed': 'Valeur hors de la liste proposée.',
    'generic.not-allowed_hint': '« {{hint}} » ne fait pas partie de la liste proposée.',
    'generic.required': 'Obligatoire.',
    'number.greater-than': 'Doit dépasser {{threshold}}.',
    'number.less-than': 'Doit rester sous {{threshold}}.',
    'number.maximum': '{{maxNumber}} au plus.',
    'number.maximum-precision': '{{limit}} décimales au plus.',
    'number.minimum': '{{minNumber}} au moins.',
    'number.non-integer': 'Nombre entier attendu.',
    'object.asset-required': 'Fichier obligatoire.',
    'object.asset-required_file': 'Fichier obligatoire.',
    'object.asset-required_image': 'Image obligatoire.',
    'object.media-not-found': 'Ce fichier est introuvable dans la médiathèque.',
    'object.not-media-library-asset': 'Doit pointer un fichier de la médiathèque.',
    'object.not-reference': 'Doit pointer un document.',
    'object.reference-not-published': 'Le document pointé doit d’abord être publié.',
    'panel.close-button-aria-label': 'Fermer la validation',
    'panel.no-errors-message': 'Aucune erreur',
    'panel.title': 'Validation',
    'panel.unpublish-message': 'Le document va être dépublié : aucune erreur n’est affichée.',
    'slug.missing-current': 'Adresse vide : la générer (bouton « Generate ») ou la taper.',
    'slug.not-object': 'Adresse illisible : la vider et la régénérer.',
    'slug.not-unique': 'Adresse déjà prise par un autre document.',
    'string.email': 'Adresse e-mail invalide.',
    'string.exact-length': 'Exactement {{wantedLength}} signes attendus.',
    'string.lowercase': 'Minuscules uniquement.',
    'string.maximum-length': '{{maxLength}} signes au plus.',
    'string.minimum-length': '{{minLength}} signes au moins.',
    'string.regex-does-not-match': 'Ne respecte pas le format « {{name}} ».',
    'string.regex-match': 'Ne doit pas respecter le format « {{name}} ».',
    'string.uppercase': 'Majuscules uniquement.',
    'string.url.disallowed-scheme': 'Ce type d’adresse n’est pas accepté ici.',
    'string.url.includes-credentials': 'Pas d’identifiant ni de mot de passe dans l’adresse.',
    'string.url.invalid': 'Adresse web invalide.',
    'string.url.not-absolute': 'Adresse complète attendue (https://…).',
    'string.url.not-relative': 'Adresse relative attendue (/…).',
  },
});

/** Les infobulles de Publish grisé, et le libellé de l'onglet par défaut. */
const structure = defineLocaleResourceBundle({
  locale: 'en-US',
  namespace: 'structure',
  overwrite: true,
  resources: {
    'action.publish.already-published.no-time-ago.tooltip': 'Déjà publié : rien n’a changé depuis.',
    'action.publish.already-published.tooltip': 'Publié {{timeSincePublished}} : rien n’a changé depuis.',
    'action.publish.disabled.not-ready': 'Le document se charge encore : patienter une seconde.',
    'action.publish.no-changes.tooltip': 'Rien à publier : aucune modification depuis la dernière publication.',
    'action.publish.validation-issues.tooltip':
      'Des erreurs bloquent la publication : leur liste est en tête du formulaire.',
    'action.publish.validation-issues-toast.title': 'Publication bloquée',
    'action.publish.validation-issues-toast.description':
      'Corriger d’abord les erreurs listées en tête du formulaire.',
    'action.publish.waiting': 'En attente de la fin de la validation…',
    'action.publish.live-edit.publish-disabled': 'Ce type de document se publie tout seul à chaque modification.',
  },
});

const studio = defineLocaleResourceBundle({
  locale: 'en-US',
  namespace: 'studio',
  overwrite: true,
  resources: {
    'inputs.object.field-group-tabs.all-fields-title': 'Tous les champs',
    'inputs.object.field-group-tabs.validation-error': 'erreur',
    'inputs.object.field-group-tabs.validation-warning': 'à vérifier',
    'inputs.object.field-group-tabs.validation-info': 'info',
  },
});

export const studioMessagesFr = [validation, structure, studio];
