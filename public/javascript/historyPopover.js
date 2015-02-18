
// Exposed variables ===========================================================

var launchHistorySelector;  // function(DOMElement, bulbHistory, callback)

{ // INTERNAL PART OF THE FILE

// Settings ====================================================================


// Globals =====================================================================

var historyPopup;
var historyPopupText;
var holdCallback;
var popoverMode = '';

// DOM Ready ===================================================================

$(document).ready(function() {
    // sets up the following DOM insert:
    //  <div class="path-popup">
    //      <span class="path-popup-body">
    //      </span>
    //      <button class="path-popup-close-button">Close</button>
    //  </div>

    $('body').append('<div class="history-popup" style="position: absolute; z-index:1000; background:#fff;"></div>');
    historyPopup = $('div.history-popup');
    historyPopup.hide();

    historyPopup.append('<div class="history-popup-body"></div>');
    historyPopupText = $('div.history-popup-body');

    historyPopup.append('<button class="history-popup-close-button">Cancel</button>');
    $('button.history-popup-close-button').click(closeClick);

    // set up click hooks for the to-be-created popover links
    $('div.history-popup-body').on('click', 'ul li a.linkPopoverClickBulb',
                                   historyClickBulb);
});

function historyClickBulb(event) {
    if (event)
        event.preventDefault();

    var bulbId = $(this).attr('rel');

    historyPopup.hide();

    holdCallback(bulbId);
}

function closeClick(event) {
    if (event)
        event.preventDefault();

    historyPopup.hide();

    // callback never gets executed.
}

function launchHistorySelector(DOMElement, bulbHistory, callback) {
    holdCallback = callback;

    // move the popup to the thing's location
    var jQElement = $(DOMElement);
    var offset = jQElement.offset();
    offset.left += jQElement.width();
    historyPopup.css(offset);

    // do the initial render
    var historyCopy = [];
    var historyString = '<ul>';

    if (bulbHistory)
        historyCopy = bulbHistory.slice();

    var aux;

    aux = function (array) {
        if (array.length == 0) {
            if (historyString)
                historyString += '</li>';
            historyString += '<li>Current</li></ul>';
            historyPopupText.html(historyString);
            historyPopup.show();
            return;
        }

        // otherwise, the array has a head node.
        var headBulb = array.shift();
        if (historyString)
            historyString += '</li>';
        historyString += '<li><a href="#" class="linkPopoverClickBulb" rel="' +
                         headBulb._id + '">' + headBulb.title + '</a>';

        aux(array);
    }

    aux(historyCopy);
}

} // end namespace bracket
