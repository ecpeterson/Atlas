// Settings ====================================================================

var width = 400,
    height = 400;

// Globals =====================================================================

var activeBulbId = '';
var activeBulb = {};
var activeBulbD3 = {};
var history = [];

var svg = {};
var force = {};
var color = {};
var graph = { nodes : [], links : []};
var link = {};
var node = {};

// DOM Ready ===================================================================

$(document).ready(function() {
    //// Set up the bulb graph

    // insert the drawing surface
    svg = d3.select('#divSVG').append('svg')
            .attr('width', width)
            .attr('height', height);

    // built-in physics simulator for automatic graph layout
    force = d3.layout.force()
              .charge(-120) // how forceful the repositioning is
              .linkDistance(60) // relaxed length of edge springs
              .size([width, height]);

    force
        .nodes(graph.nodes)
        .links(graph.links)
        .start();

    link = svg.selectAll(".link");
    node = svg.selectAll(".node");

    color = d3.scale.category20();

    // instruct svg on how to draw arrowheads
    svg.append("defs").selectAll("marker")
        .data(["suit", "licensing", "resolved"])
        .enter()
            .append("marker")
                .attr("id", function(d) { return d; })
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 25)
                .attr("refY", 0)
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
            .append("path")
                .attr("d", "M0,-5L10,0L0,5 L10,0 L0, -5")
                .style("stroke", "#4679BD")
                .style("opacity", "0.6");

    // each time the force simulation has a tick, we share the recalculated
    // positions with the SVG elements, thereby displaying the changes.
    force.on('tick', drawGraphCallback);

    //// Pull down the bulb data

    populateTables();

    // we just got the bulb data; oh well, get it again.
    $.getJSON('/toplevel', function(data) {
        if (data.length > 0) {
            // tell D3 to start running the simulation with the blank tables
            selectBulb(null, data[0]._id);
            restartGraph();
        }
    });

    //// Set up button hooks

    // when the 'add' button is clicked, call the JS routine below
    $('#btnNewBulb').on('click', newBulb);

    // when a bulb name is clicked, call the JS routine below
    $('#bulbList ul').on('click', 'li a.linkShowBulb', selectBulb);
    $('#bulbInfoOutgoingNodes ul').on('click', 'li a.linkShowBulb', selectBulb);

    // when the 'delete' button is clicked, call the JS routine below
    //
    // remark: you must hook jQuery on a static page element, like the tbody
    // element, and then key on what you actually want in the second parameter.
    $('#bulbInfo').on('click', 'a.linkDeleteBulb', deleteBulb);

    // when the 'update' button is clicked, call the JS routine below
    $('#bulbInfo').on('click', 'a.linkUpdateBulb', updateBulb);

    // when the [+] button is clicked, add a link
    $('a.bulbInfoAddOutgoingRef').on('click', '', addLink);

    // when the [-] button is clicked, remove the link
    $('#bulbInfoOutgoingNodes ul').on('click', 'li a.linkDeleteLink', removeLink);

    // when new text is entered, make mathjax rerender it.
    $('textarea#bulbInfoText').on('keyup blur',
        function () { bulbTextNeedsRerender = true; });

    // call MathJaX periodically to render the bulb text
    setInterval(rerenderBulbText, 3000);
});

// Utility functions ===========================================================

function drawGraphCallback () {
    // update edge positions
    link
        .attr('x1', function (d) {
            return d.source.x;
        })
        .attr('y1', function (d) {
            return d.source.y;
        })
        .attr('x2', function (d) {
            return d.target.x;
        })
        .attr('y2', function (d) {
            return d.target.y;
        });

        // update circle positions
    d3.selectAll('circle')
        .attr('cx', function (d) {
            return d.x;
        })
        .attr('cy', function (d) {
            return d.y;
        });

    // update label positions
    d3.selectAll('text')
        .attr('x', function (d) {
            return d.x;
        })
        .attr('y', function (d) {
            return d.y;
        });
}

function restartGraph() {
    link = link.data(graph.links); // we're going to reset the link data to this
    link.enter() // for all incoming links...
            .append('line')
                .attr('class', 'link')
                .style('marker-end', 'url(#suit)'); // this draws arrowheads
    link.exit() // for all outgoing links...
            .transition()
            .duration(4000)
            .style("opacity", 0)
            .tween("keepLinksMoving", function (d, i) {
                var activeLink = d3.select(this);
                return function (t) {
                    activeLink
                        .attr("x1", d.source.x)
                        .attr("y1", d.source.y)
                        .attr("x2", d.target.x)
                        .attr("y2", d.target.y);
                }
            })
            .remove();

    node = node.data(graph.nodes) // we're going to reset the node data to this
    node.enter() // for all incoming nodes...
            .append('g')
                .attr('class', 'node')
                .on('click', function () {
                    d = d3.select(this).node();
                    console.log(JSON.stringify(d));
                    selectBulb(null, d._id);
                    return;
                })
                // .on('dblclick', function () { return; })
            .append("circle")
                .attr('r', 8)
                .style("full", function (d) {
                    return "red";
                })
            .append("text")
                .attr("dx", 10)
                .attr("dy", ".35em")
                .text(function (d) {
                    return d.title;
                })
                .style("stroke", "black");
    node.exit() // for all outgoing nodes...
        .transition()
            .duration(4000)
            .style("opacity", 0)
            .remove();

    force.start();
}

var bulbTextNeedsRerender = false;
var rerenderBulbText;
{
    var textSource = $('#bulbInfoText');
    var textTarget = $('#bulbInfoRenderedText');

    rerenderBulbText = function () {
        if (!bulbTextNeedsRerender ||
            MathJax.Hub.Queue.pending)
            return;

        bulbTextNeedsRerender = false;

        var content = textSource.val();

        content = '<p>' + content.replace(/\n([ \t]*\n)+/g, '</p><p>')
                 .replace('\n', '<br />') + '</p>';

        textTarget.html(content);
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, "bulbInfoRenderedText"]);

        return;
    }
}

// User-triggerable functions ==================================================

// generates the HTML displaying bulb list
function populateTables() {
	// this is the string we're going to insert into the document later
	var liListContent = '';
    var selectListContent = '';

	// jQuery AJAX call for JSON
	$.getJSON('/toplevel', function(data) {
		// for each item in our JSON, add a table row to the content structure
		$.each(data, function() {
            liListContent += '<li>';
            liListContent += '<a href="#" class="linkShowBulb" rel="' + this._id +
                           '" title="Show details">' + this.title + '</a> ';
            liListContent += '</li>';

            selectListContent += '<option value="' + this._id + '">' +
                                 this.title + '</option>';
		});

		// inject this content string into our existing HTML table.
        // NOTE: this overwrites whatever was there before.
		$('#bulbList ul').html(liListContent);
        $('#bulbInfoOutgoingSelector select').html(selectListContent);
	});
};

// adds a new bulb to the database
function newBulb(event) {
    // prevents the browser from going anywhere
    event.preventDefault();

    $.post(
        '/newbulb',
        null, // data to post
        function(response) {
            // a successful response is a blank response.
            if (response.msg) {
                alert('Error: ' + response.msg);
            }
        }
    );

    populateTables();
};

function selectBulb(event, bulbId) {
    if (event)
        event.preventDefault();

    // if we're passed a bulbId, use it. o/w, try to extract from the DOM event
    if (!bulbId)
        bulbId = $(this).attr('rel');

    // if the new bulb is in the list of outgoing bulbs for the current bulb...
    if (activeBulb && activeBulb.outgoingNodes &&
        activeBulb.outgoingNodes.indexOf(bulbId) > -1)
        // ... then push the current bulb into the history array
        history.push(activeBulbId);
    else
        // ... otherwise, clear the history array.
        history = [];

    // in any case, set the current bulb to be the new bulb.
    activeBulbId = bulbId;

    // now we actually need the contents of the current bulb, so grab it.
    $.getJSON('/bulb/' + activeBulbId, function(response) {
        if (response.msg) {
            alert('Error: ' + response.msg);
            return;
        }

        activeBulb = response;

        // now we're going to assemble the list of vertices (graph.nodes) and
        // edges (graph.links) to display. they start empty each time.
        graph.nodes = [];
        graph.links = [];
        var historyChain = [];
        { // CENTER:
            // add the current bulb to the list of vertices
            historyChain.push(activeBulb);
        }
        { // HISTORY and CENTER:
            // start by assembling the incoming history chain
            if (history.length > 2)
                historyChain.push({ _id : "historyDummyNode",
                                    title : "..." });
            historyChain.concat(history.slice(history.length-2,
                                              history.length));
            historyChain.push(activeBulb);

            // add those bulbs to the vertex collection
            graph.nodes.concat(historyChain);

            // now iterate through these few vertices to draw in the edges
            var i = 0;
            for (i = 0; i < historyChain.length - 1; i++) {
                var sourceNode = historyChain[i];
                var targetNode = historyChain[i + 1];

                graph.links.push({ source : sourceNode._id,
                                   target : targetNode._id });
            }
        }
        { // OUTGOING:
            // grab the essential data of outgoing bulbs from the current bulb
            $.post( '/graphdata',
                    { ids : activeBulb.outgoingNodes },
                    function(outgoingBulbs) {
                    // insert them as vertices
                    graph.nodes.push(outgoingBulbs);

                    // insert edges from the current bulb to the outgoing bulbs
                    outgoingBulbs.forEach(function (outBulb) {
                        graph.links.push({ source : activeBulbId,
                                           target : outBulb._id });

                        // filter edges from the outgoing bulbs to those bulbs
                        // which are part of the list of bulbs to display.
                        // if we can't find outOutBulb's id...
                        outBulb.outgoingBulbs.forEach(function (outOutBulb) {
                            if (graph.nodes.filter(function(thisBulb) {
                                    thisBulb._id == outOutBulb;
                                }).length == 0)
                                return; // then just bail.

                            // but if we can find it, insert that edge too
                            graph.links.push({ source : outBulb._id,
                                               target : outOutBulb });
                        });
                    });

                    // finally, call the restart() function to push the changes
                    // to the graph. ideally this would be done two levels up,
                    // but since this step requires asynchronous JSON calls, we
                    // have to do it here.

                    restartGraph();

                    // TODO: finally, you should place some of these nodes in
                    // fixed positions.
                }
            );
        }

        // update the active bulb info fields
        $('#bulbInfoTitle').val(response.title);
        $('#bulbInfoId').text(response._id);
        $('#bulbInfoType').text(response.type);
        $('#bulbInfoResolved')[0].checked = response.resolved;
        $('#bulbInfoOutgoingNodes ul').html('');
        $.each(response.outgoingNodes, function() {
            $.getJSON('/bulb/' + this, function(listBulb) {
                var listContent = '';
                listContent += '<li>';
                listContent += '<a href="#" class="linkShowBulb" rel="' +
                               listBulb._id + '" title="Show details">' +
                               listBulb.title + '</a> ';
                listContent += '<a href="#" class="linkDeleteLink" rel="' +
                               listBulb._id +
                               '" title="Delete Link"> [ - ] </a> ';
                listContent += '</li>';
                $('#bulbInfoOutgoingNodes ul').append(listContent);
            });
        });
        $('#bulbInfoModificationTime').text(response.modificationTime);
        if (response.parents) {
            $('#bulbInfoParentsWorkspaceId').text(response.parents.workspaceId);
            $('#bulbInfoParentsContainerId').text(response.parents.containerId);
            $('#bulbInfoParentsOriginalId').text(response.parents.originalId);
        }
        $('#bulbInfoShares').text(response.shares);
        $.getJSON('/user/' + response.ownerId, function (userinfo) {
            if (userinfo.msg) {
                alert('Error: ' + userinfo.msg);
                return;
            }
            $('#bulbInfoOwner').html(userinfo.name + ' (<a href="mailto:' +
                userinfo.email + '">' + userinfo.email + '</a>)');
        });

        // to save space, we moved the text part into a different call
        $.getJSON('/bulb/' + activeBulbId + '/text', function (response) {
            $('#bulbInfoText').val(response.text);
            bulbTextNeedsRerender = true;
            rerenderBulbText(); // cause an immediate re-render.
        });
    });
}

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
        
        populateTables();
        $('#bulbInfo span').text('');
        $('#bulbInfo input').val('');
        activeBulbId = '';
        activeBulb = {};
    });
};

// updates a bulb
function updateBulb(event) {
    if (event)
        event.preventDefault();

    if (!activeBulbId)
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
        if (response.msg) {
            alert('Error: ' + response.msg);
            // don't throw out the user's changes if we failed to commit.
            return;
        }

        populateTables();
        selectBulb(event, activeBulbId);
    });
};

function addLink(event) {
    if (event)
        event.preventDefault();

    launchPathSelector(event.target, function (path) { return; });

    var selector = $('#bulbInfoOutgoingSelector select');

    if (!activeBulbId || !selector.val())
        return;

    // validation:
    if ((selector.val() == activeBulbId) || // can't select ourselves
        (activeBulb.outgoingNodes.indexOf(selector.val()) > -1)) // can't repeat
        return;

    // add this to our list of links
    activeBulb.outgoingNodes.push(selector.val());

    // push the update to the remote server
    updateBulb(null);
}

function removeLink(event) {
    if (event)
        event.preventDefault();

    targetId = $(this).attr('rel');

    activeBulb.outgoingNodes = activeBulb.outgoingNodes.filter(function (b) {
        return (b != targetId);
    });

    updateBulb(null);
}
