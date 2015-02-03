// Settings ====================================================================


// Globals =====================================================================

var popup;
var popupText;
var holdCallback;

// DOM Ready ===================================================================

$(document).ready(function() {
    // sets up the following DOM insert:
    //  <div class="path-popup">
    //      <span class="path-popup-body">
    //      </span>
    //      <button class="path-popup-close-button">Close</button>
    //  </div>

    $('body').append('<div class="path-popup" style="position: absolute; z-index:1000; background:#fff;"></div>');
    popup = $('div.path-popup');
    popup.hide();

    popup.append('<div class="path-popup-body"></div>');
    popupText = $('div.path-popup-body');

    popup.append('<button class="path-popup-close-button">Close</button>');
    $('button.path-popup-close-button').click(closeClick);
});

function closeClick(event) {
    if (event)
        event.preventDefault();

    popup.hide();

    holdCallback(null);
}

//function launchPathSelector(DOMElement, function callback(path) { ... })
function launchPathSelector(DOMElement, callback) {
    holdCallback = callback;

    // move the popup to the thing's location
    var jQElement = $(DOMElement);
    var offset = jQElement.offset();
    offset.left += jQElement.width();
    popup.css(offset);

    popupText.html('<p>Some dummy text for the popover.</p>');

    popup.show();
}
