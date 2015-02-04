// Settings ====================================================================


// Globals =====================================================================

var popup;
var popupText;
var holdCallback;
var backgroundPath;

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

    popup.append('<button class="path-popup-close-button">Cancel</button>');
    $('button.path-popup-close-button').click(closeClick);

    // set up click hooks for the to-be-created popover links
    $('#bulbList ul').on('click', 'li a.linkShowBulb', selectBulb);
    $('div.path-popup-body').on('click', 'ul li a.linkPopoverSelectWorkspace',
                                popoverSelectWorkspace);
    $('div.path-popup-body').on('click', 'ul li a.linkPopoverSelectBulb',
                                popoverSelectBulb);
    $('div.path-popup-body').on('click', 'strong a.linkPopoverChooseThis',
                                popoverChooseThis);
    $('div.path-popup-body').on('click', 'ul li a.linkPopoverDeselect',
                                popoverDeselect);
});

function popoverSelectWorkspace(event) {
    if (event)
        event.preventDefault();

    var workspaceId = $(this).attr('rel');

    backgroundPath.workspace = workspaceId;

    $.getJSON('/workspace/' + workspaceId + '/children', function (bulbs) {
        if (bulbs.length > 0) {
            renderPopover();
        } else {
            popoverChooseThis(null);
        }
    });
}

function popoverSelectBulb(event) {
    if (event)
        event.preventDefault();

    var bulbId = $(this).attr('rel');

    backgroundPath.path.push(bulbId);

    $.getJSON('/bulb/' + bulbId + '/children', function (bulbs) {
        if (bulbs.length > 0) {
            renderPopover();
        } else {
            popoverChooseThis(null);
        }
    });
}

function popoverChooseThis(event) {
    if (event)
        event.preventDefault();

    popup.hide();

    holdCallback(backgroundPath);
}

function popoverDeselect(event) {
    if (event)
        event.preventDefault();

    if (backgroundPath.path.length > 0) {
        backgroundPath.path.pop();
    } else {
        backgroundPath.workspace = '';
    }

    renderPopover();
}

function closeClick(event) {
    if (event)
        event.preventDefault();

    popup.hide();

    // callback never gets executed.
}

// gets called whenever the data in the popover needs to be updated
function renderPopover() {
    var renderString = '';

    // there are three situations we could be in.

    if (!backgroundPath.path.length &&
        !backgroundPath.workspace) {
        // WE'RE NOT IN A WORKSPACE OR A CONTAINER: WE'RE AT THE TOPMOST LEVEL.

        // render the header: just a 'toplevel' banner
        renderString += '<strong>Toplevel</strong>';

        // render the node selection links at this location
        $.getJSON('/toplevel', function(bulbData) {
            $.getJSON('/workspaces', function(workspaceData) {
                renderString += '<ul>';

                // don't render the up-level link since we're at the top level

                $.each(workspaceData, function (workspace) {
                    renderString += '<li><a href="#" ' +
                                    'class="linkPopoverSelectWorkspace" rel="' +
                                    this._id + '">' + this.title +
                                    '</a></li>';
                });

                $.each(bulbData, function (bulb) {
                    renderString += '<li><a href="#" ' +
                                    'class="linkPopoverSelectBulb" rel="' +
                                    this._id + '">' + this.title +
                                    '</a></li>';
                });

                renderString += '</ul>';
                
                // overwrite whatever HTML used to be there
                popupText.html(renderString);
            });
        });

    } else if (!backgroundPath.path.length &&
               backgroundPath.workspace) {
        // WE'RE IN A WORKSPACE BUT HAVEN'T YET GONE INSIDE A CONTAINER

        $.getJSON('/workspace/' + backgroundPath.workspace,
                  function(workspace) {
            $.getJSON('/workspace/' + backgroundPath.workspace + '/children',
                      function(bulbs) {
                // render the header: name of the selected workspace
                renderString += '<strong><a href="#" ' +
                                'class="linkPopoverChooseThis">' +
                                workspace.title + '</a></strong>';

                // render the up-directory link
                renderString += '<ul>';
                renderString += '<li><a href="#" class="linkPopoverDeselect" ' +
                                '>..</a></li>';

                // render the toplevel nodes at this location
                $.each(bulbs, function (bulb) {
                    renderString += '<li><a href="#" ' +
                                    'class="linkPopoverSelectBulb" rel="' +
                                    this._id + '">' + this.title + '</a></li>';
                });

                renderString += '</ul>';

                popupText.html(renderString);
            });
        });

    } else {
        // WE'RE IN A CONTAINER.

        var bulbId = backgroundPath.path[backgroundPath.path.length - 1];

        $.getJSON('/bulb/' + bulbId, function(bulb) {
            $.getJSON('/bulb/' + bulbId + '/children', function (bulbs) {
                // render the header: name of the current node
                renderString += '<strong><a href="#" ' +
                                'class="linkPopoverChooseThis">' +
                                bulb.title + '</a></strong>';

                // render the up-directory link
                renderString += '<ul>';
                renderString += '<li><a href="#" class="linkPopoverDeselect" ' +
                                '>..</a></li>';

                // render the toplevel nodes at this location
                $.each(bulbs, function (bulb) {
                    renderString += '<li><a href="#" ' +
                                    'class="linkPopoverSelectBulb" rel="' +
                                    this._id + '">' + this.title + '</a></li>';
                });

                renderString += '</ul>';

                popupText.html(renderString);
            });
        });
    }
}

//function launchPathSelector(DOMElement, function callback(path) { ... })
function launchPathSelector(DOMElement, callback) {
    holdCallback = callback;

    // move the popup to the thing's location
    var jQElement = $(DOMElement);
    var offset = jQElement.offset();
    offset.left += jQElement.width();
    popup.css(offset);

    // initialize the state of the popover:
    // set the background path object to empty.
    backgroundPath = {  workspace : '',
                        path : [] };

    // do the initial render
    renderPopover();

    popup.show();
}
