// if we were to need persistent globals, they'd go here.

var activeBulbId = '';
var activeBulb = {};

// DOM Ready ===================================================================
$(document).ready(function() {
	// populate the bulb list on initial page load
	populateTable();

    // when the 'add' button is clicked, call the JS routine below
    $('#btnNewBulb').on('click', newBulb);

    // when a bulb name is clicked, call the JS routine below
    $('#bulbList ul').on('click', 'li a.linkShowBulb', showBulbInfo);

    // when a 'delete' button is clicked, call the JS routine below
    //
    // remark: you must hook jQuery on a static page element, like the tbody
    // element, and then key on what you actually want in the parameter list.
    $('#bulbInfo').on('click', 'a.linkDeleteBulb', deleteBulb);

    $('#bulbInfo').on('click', 'a.linkUpdateBulb', updateBulb);
});

// Functions ===================================================================

// generates the HTML displaying bulb list
function populateTable() {
	// this is the string we're going to insert into the document later
	var listContent = '';

	// jQuery AJAX call for JSON
	$.getJSON('/visiblebulbs', function(data) {
		// for each item in our JSON, add a table row to the content structure
		$.each(data, function() {
            listContent += '<li>';
            listContent += '<a href="#" class="linkShowBulb" rel="' + this._id +
                           '" title="Show details">' + this.title + '</a> ';
            listContent += '</li>';
		});

		// inject this content string into our existing HTML table
		$('#bulbList ul').html(listContent);
	});
};

// adds a new bulb to the database
function newBulb(event) {
    // prevents the browser from going anywhere
    event.preventDefault();

    $.ajax({
        type : 'POST',
        url : '/newbulb',
        data : '',
        dataType : 'json',
        success : function(response) {
            // a successful response is a blank response.
            if (response.msg) {
                alert('Error: ' + response.msg);
            }
        }
    });

    populateTable();
};

// populates the detailed bulb info fields upon request
function showBulbInfo(event) {
	// prevents the browser from going anywhere
	event.preventDefault();

	activeBulbId = $(this).attr('rel');

    // retrieve the bulb's information from /node/.
    $.getJSON('/bulb/' + activeBulbId, function(response) {
        if (response.msg) {
            alert('Error: ' + response.msg);
            return;
        }

        activeBulb = response;

        // TODO: I do not understand why jQuery is returning a list of results
        // for #bulbInfoResolved.

        $('#bulbInfoTitle').val(response.title);
        $('#bulbInfoId').text(response._id);
        $('#bulbInfoType').text(response.type);
        $('#bulbInfoResolved')[0].checked = response.resolved;
        $('#bulbInfoOutgoingNodes').text(response.outgoingNodes);
        $('#bulbInfoModificationTime').text(response.modificationTime);
        if (response.parents) {
            $('#bulbInfoParentsWorkspaceId').text(response.parents.workspaceId);
            $('#bulbInfoParentsContainerId').text(response.parents.containerId);
            $('#bulbInfoParentsOriginalId').text(response.parents.originalId);
        }
        $('#bulbInfoShares').text(response.shares);
        $('#bulbInfoText').val(response.text);
    });
};

// deletes a bulb
function deleteBulb(event) {
    // prevents the browser from going anywhere
    event.preventDefault();

    if (activeBulbId == '')
        return;

    var confirmation = confirm('Are you sure you want to delete the active bulb?');

    if (confirmation === false) {
        return false;
    }

    // OK, they said they really want to delete the bulb. let's do it.
    $.ajax({
        type : 'DELETE',
        url : '/bulb/' + activeBulbId
    }).done(function(response) {
        if (response.msg)
            alert('Error: ' + response.msg);
        
        populateTable();
        $('#bulbInfo span').text('');
        $('#bulbInfo input').val('');
        activeBulbId = '';
        activeBulb = {};
    });
};

// updates a bulb
function updateBulb(event) {
    event.preventDefault();

    if (activeBulbId == '')
        return;

    var freshBulb = activeBulb;
    freshBulb.title = $('#bulbInfoTitle').val();
    freshBulb.resolved = $('#bulbInfoResolved')[0].checked;
    freshBulb.text = $('#bulbInfoText').val();

    $.ajax({
        type : 'PUT',
        url : '/bulb/' + activeBulbId,
        data : freshBulb,
        dataType : 'JSON'
    }).done(function(response) {
        if (response.msg)
            alert('Error: ' + response.msg);

        populateTable();
        showBulbInfo();
    });
};
