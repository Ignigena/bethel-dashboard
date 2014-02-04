/**
 * @file
 * Attaches behaviors for the Contextual module.
 */

(function ($, Drupal, drupalSettings, Backbone) {

"use strict";

var options = $.extend(drupalSettings.contextual,
  // Merge strings on top of drupalSettings so that they are not mutable.
  {
    strings: {
      open: Drupal.t('Open'),
      close: Drupal.t('Close')
    }
  }
);

/**
 * Initializes a contextual link: updates its DOM, sets up model and views
 *
 * @param jQuery $contextual
 *   A contextual links placeholder DOM element, containing the actual
 *   contextual links as rendered by the server.
 */
function initContextual ($contextual) {
  var $region = $contextual.closest('.contextual-region');
  var contextual = Drupal.contextual;

  $contextual
    // Use the placeholder as a wrapper with a specific class to provide
    // positioning and behavior attachment context.
    .addClass('contextual')
    // Ensure a trigger element exists before the actual contextual links.
    .prepend(Drupal.theme('contextualTrigger'));

  // Create a model and the appropriate views.
  var model = new contextual.StateModel({
    title: $region.find('h2:first').text().trim()
  });
  var viewOptions = $.extend({ el: $contextual, model: model }, options);
  contextual.views.push({
    visual: new contextual.VisualView(viewOptions),
    aural: new contextual.AuralView(viewOptions),
    keyboard: new contextual.KeyboardView(viewOptions)
  });
  contextual.regionViews.push(new contextual.RegionView(
    $.extend({ el: $region, model: model }, options))
  );

  // Add the model to the collection. This must happen after the views have been
  // associated with it, otherwise collection change event handlers can't
  // trigger the model change event handler in its views.
  contextual.collection.add(model);

  // Let other JavaScript react to the adding of a new contextual link.
  $(document).trigger('drupalContextualLinkAdded', {
    $el: $contextual,
    $region: $region,
    model: model
  });

  // Fix visual collisions between contextual link triggers.
  adjustIfNestedAndOverlapping($contextual);
}

/**
 * Determines if a contextual link is nested & overlapping, if so: adjusts it.
 *
 * This only deals with two levels of nesting; deeper levels are not touched.
 *
 * @param jQuery $contextual
 *   A contextual links placeholder DOM element, containing the actual
 *   contextual links as rendered by the server.
 */
function adjustIfNestedAndOverlapping ($contextual) {
  var $contextuals = $contextual
    // @todo confirm that .closest() is not sufficient
    .parents('.contextual-region').eq(-1)
    .find('.contextual');

  // Early-return when there's no nesting.
  if ($contextuals.length === 1) {
    return;
  }

  // If the two contextual links overlap, then we move the second one.
  var firstTop = $contextuals.eq(0).offset().top;
  var secondTop = $contextuals.eq(1).offset().top;
  if (firstTop === secondTop) {
    var $nestedContextual = $contextuals.eq(1);

    // Retrieve height of nested contextual link.
    var height = 0;
    var $trigger = $nestedContextual.find('.trigger');
    // Elements with the .visually-hidden class have no dimensions, so this
    // class must be temporarily removed to the calculate the height.
    $trigger.removeClass('visually-hidden');
    height = $nestedContextual.height();
    $trigger.addClass('visually-hidden');

    // Adjust nested contextual link's position.
    $nestedContextual.css({ top: $nestedContextual.position().top + height });
  }
}

/**
 * Attaches outline behavior for regions associated with contextual links.
 *
 * Events
 *   Contextual triggers an event that can be used by other scripts.
 *   - drupalContextualLinkAdded: Triggered when a contextual link is added.
 */
Drupal.behaviors.contextual = {
  attach: function (context) {
    var $context = $(context);

    // Find all contextual links placeholders, if any.
    var $placeholders = $context.find('[data-contextual-id]').once('contextual-render');
    if ($placeholders.length === 0) {
      return;
    }

    // Collect the IDs for all contextual links placeholders.
    var ids = [];
    $placeholders.each(function () {
      ids.push($(this).attr('data-contextual-id'));
    });

    // Perform an AJAX request to let the server render the contextual links for
    // each of the placeholders.
    $.ajax({
      url: Drupal.url('contextual/render') + '?destination=' + Drupal.encodePath(drupalSettings.currentPath),
      type: 'POST',
      data: { 'ids[]' : ids },
      dataType: 'json',
      success: function (results) {
        for (var id in results) {
          // If the rendered contextual links are empty, then the current user
          // does not have permission to access the associated links: don't
          // render anything.
          if (results.hasOwnProperty(id) && results[id].length > 0) {
            // Update the placeholders to contain its rendered contextual links.
            // Usually there will only be one placeholder, but it's possible for
            // multiple identical placeholders exist on the page (probably
            // because the same content appears more than once).
            var $placeholders = $context
              .find('[data-contextual-id="' + id + '"]')
              .html(results[id]);

            // Initialize the contextual links.
            for (var i = 0; i < $placeholders.length; i++) {
              initContextual($placeholders.eq(i));
            }
          }
        }
      }
     });
  }
};

Drupal.contextual = {
  // The Drupal.contextual.View instances associated with each list element of
  // contextual links.
  views: [],

  // The Drupal.contextual.RegionView instances associated with each contextual
  // region element.
  regionViews: []
};

// A Backbone.Collection of Drupal.contextual.StateModel instances.
Drupal.contextual.collection = new Backbone.Collection([], { model: Drupal.contextual.StateModel });

/**
 * A trigger is an interactive element often bound to a click handler.
 *
 * @return String
 *   A string representing a DOM fragment.
 */
Drupal.theme.contextualTrigger = function () {
  return '<button class="trigger visually-hidden focusable" type="button"></button>';
};

})(jQuery, Drupal, drupalSettings, Backbone);
