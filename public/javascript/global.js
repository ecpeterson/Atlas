// Settings ====================================================================

var width = 800,
    height = 400;

// Globals =====================================================================

var activeBulbId = '';
var activeBulb = {};
var activeBulbD3 = {};
var bulbHistory = [];

var clickStates = {
    SELECT : 'SELECT',
    LINK : 'LINK',
    DELINK : 'DELINK'
};
var state = clickStates.SELECT;

var svg = {};
var force = {};
var color = {};
var graph =
    {
        nodes : [],
        links : []
    };
var link = {};
var node = {};

var debug = 0;

// DOM Ready ===================================================================

$(document).ready(function() {
    //// Set up the bulb graph

    // insert the drawing surface
    svg = d3.select('#divSVG')
        .append('svg:svg')
            .attr('width', width)
            .attr('height', height);

    // built-in physics simulator for automatic graph layout
    force = d3.layout.force()
              .charge(-180) // how forceful the repositioning is
              .linkDistance(120) // relaxed length of edge springs
              .size([width, height]);

    force
        .nodes([])
        .links([])
        .start();

    link = svg.selectAll(".link");
    node = svg.selectAll(".node");

    color = d3.scale.category20();

    // instruct svg on how to draw arrowheads
    svg.append("defs").selectAll("marker")
        .data(["suit"])
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
    $.getJSON('/toplevel', function(data) {
        if (data.length > 0) {
            // tell D3 to start running the simulation with the blank tables
            activeBulb = {}; activeBulbId = '';
            selectBulb(null, data[0]._id);
        }
    });

    //// Set up button hooks

    // when the 'add' button is clicked, call the JS routine below
    $('#btnNewBulb').on('click', newBulb);

    // when a bulb name is clicked, call the JS routine below
    //$('#bulbList ul').on('click', 'li a.linkShowBulb', selectBulb); // XXX: WTF
    $('#bulbInfoOutgoingNodes').on('click', 'li a.linkShowBulb', selectBulb);
    $('#bulbInfoContainsNodes').on('click', 'li a.linkShowBulb', selectBulb);
    $('#historyDisplay').on('click', 'a.linkShowBulb', selectBulb);

    // when the 'delete' button is clicked, call the JS routine below
    //
    // remark: you must hook jQuery on a static page element, like the tbody
    // element, and then key on what you actually want in the second parameter.
    $('#bulbInfo').on('click', 'a.linkDeleteBulb', deleteBulb);

    // when the 'update' button is clicked, call the JS routine below
    $('#bulbInfo').on('click', 'a.linkUpdateBulb', updateBulb);

    // when the parent permalinks are clicked, let the client choose the parents
    $('a.parentWorkspacePicker').on('click', pickParentWorkspace);
    $('a.parentContainerPicker').on('click', pickParentContainer);
    $('#bulbInfoParentsContainerId').on('click', 'a', selectBulb);

    // when the original parent permalink is clicked, synchronize the node
    $('#bulbInfoParentsOriginalId').on('click', 'a.syncWithOriginal',
                                       syncBulbWithOriginal);

    // navigation clicker
    $('a#navigateButton').on('click', navigateClicked);

    // duplicate node button
    $('a#duplicateNode').on('click', duplicateNodeFn);

    $('a#jostleButton').on('click', function (event) {
        if (event) event.preventDefault();
        node.each(function (d) { d.x = Math.random() * width;
                                 d.y = Math.random() * height;
                                 force.resume(); });
    });

    // hook up the graph state buttons
    $('a#selectButton').on('click', function(event) {
        if (event) event.preventDefault();
        state = clickStates.SELECT;
    });
    $('a#linkButton').on('click', function() {
        if (event) event.preventDefault();
        state = clickStates.LINK;
    });
    $('a#unlinkButton').on('click', function() {
        if (event) event.preventDefault();
        state = clickStates.UNLINK;
    });

    // when new text is entered, make mathjax rerender it.
    $('textarea#bulbInfoText').on('keyup blur',
        function () { bulbTextNeedsRerender = true; });

    // call MathJaX periodically to render the bulb text
    setInterval(rerenderBulbText, 5000);
});

// Utility functions ===========================================================

function clickBulb(d, i) {
    if (d._id == 'historyDummyNode') {
        // clicking on the ... node has only one effect: it shows the history
        // popover, which in turn calls selectBulb.
        launchHistorySelector(this, bulbHistory, function (bulbId) {
            selectBulb(null, bulbId);
        });
        return;
    }

    switch (state) {
        case clickStates.SELECT: {
            selectBulb(null, d._id);
            return;
        }

        case clickStates.LINK: {
            addLink(d._id);
            return;
        }

        case clickStates.UNLINK: {
            removeLink(d._id);
            return;
        }
    }

    console.log("Unhandled click state!");
    return;
}

function drawGraphCallback () {
    // update edge positions
    link
        .attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });

    // update circle positions
    var shortHistory = bulbHistory.slice(-2).map(function (b) {
        return b._id;
    });

    node
        .each(function(d, i) {
            // if we're the highlighted node, then move us to the middle
            if (d._id == activeBulbId) {
                d.fixed = false;
                d.x = d.px = width / 2;
                d.y = d.py = height / 2;
                d.fixed = true;
                return;
            }

            // if we live in the history, then put us into the up-left chain
            if (d._id == 'historyDummyNode') {
                d.fixed = false;
                d.x = d.px = width / 8;
                d.y = d.py = height / 8;
                d.fixed = true;
                return;
            }
            var forwardIndex = shortHistory.indexOf(d._id);
            if (forwardIndex != -1) {
                if (shortHistory.length - forwardIndex == 2) {
                    d.fixed = false;
                    d.x = d.px = width / 4;
                    d.y = d.py = height / 4;
                    d.fixed = true;
                    return;
                } else if (shortHistory.length - forwardIndex == 1) {
                    d.fixed = false;
                    d.x = d.px = width * 3 / 8;
                    d.y = d.py = height * 3 / 8;
                    d.fixed = true;
                    return;
                }
            }
            
            // default:
            d.fixed = false;
            return;
        })
        .attr('transform', function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });

    // control circle colors
    node.selectAll('circle')
        .style('fill', function (d) {
            if (d._id == activeBulbId)
                return 'red';

            if (shortHistory.indexOf(d._id) != -1 ||
                d._id == 'historyDummyNode')
                return '#4488ff';

            if (activeBulb.outgoingNodes &&
                activeBulb.outgoingNodes.indexOf(d._id) != -1)
                return 'green';

            return 'blue';
        })
        .style('opacity', function (d) {
            if (d._id == 'historyDummyNode' ||
                shortHistory.indexOf(d._id) != -1)
                return 0.3;
            return 1.0;
        });
}

function restartGraph() {
    // links come with source and target set to id strings. need to dereference.
    graph.links.forEach(function(link) {
        var i;
        for (i = 0; i < graph.nodes.length; i++) {
            if (graph.nodes[i]._id == link.source)
                link.source = i;
            if (graph.nodes[i]._id == link.target)
                link.target = i;
        }
    });

    link = link.data(graph.links); // we're going to reset the link data to this
    link.enter() // for all incoming links...
            .append('line')
                .attr('class', 'link')
                .style('marker-end', 'url(#suit)'); // this draws arrowheads
    link.exit() // for all outgoing links...
            .remove();

    // we're going to reset the node data to this
    node = node.data(graph.nodes, function (d, i) { return d._id });
    // for all incoming nodes...
    var nodeg =
        node.enter()
            .append('g')
                .attr('class', 'node')
                .on('click', clickBulb);
                // .on('dblclick', function () { return; })
    nodeg.each(function (d) {
                d.x = Math.random() * width;
                d.y = Math.random() * height;
            });
    nodeg
        .append("circle")
            .attr('r', 8)
            .style("fill", function (d) {
                return "red";
            })
            .style("stroke", "black")
            .attr("dx", 0)
            .attr("dy", 0);
    nodeg
        .append("text")
            .attr("dx", 10)
            .attr("dy", ".35em")
            .text(function (d) {
                return d.title;
            });

    // for all outgoing nodes...
    node.exit()
        .transition()
            .duration(1000)
            .style("opacity", 0)
            .remove();

    // for all nodes, regardless of transition...
    node
        .each(function (d) {
            d3.select(this).select('text').text(d.title)
        });

    force
        .nodes(graph.nodes)
        .links(graph.links)
        .start();
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

        content = content.replace(/---/g, '`&mdash;`');
        content = content.replace(/--/g, '`&ndash;`');

        contentArray = content.split('`');
        content = '';
        var index;
        for (index = 0; index < contentArray.length; index++) {
            if (index % 2 == 0)
                content +=
                    markdown.toHTML(contentArray[index])
                        .slice(0,-4) // remove trailing </p>
                        .substring(3); // remove leading <p>
            else
                content += contentArray[index];
        }

        textTarget.html(content);
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, "bulbInfoRenderedText"]);

        return;
    }
}

function safelyAddBulbTo(bulb, array) {
    var i;

    for (i = 0; i < array.length; i++) {
        if (array[i]._id == bulb._id) {
            array[i] = bulb;
            return array;
        }
    }

    array.push(bulb);
    return array;
}

// User-triggerable functions ==================================================

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

            safelyAddBulbTo(response, graph.nodes);
            restartGraph();
        }
    );
};

function selectBulb(event, bulbId) {
    if (event)
        event.preventDefault();

    // if we're passed a bulbId, use it. o/w, try to extract from the DOM event
    if (!bulbId)
        bulbId = $(this).attr('rel');

    // update the history array
    if (activeBulbId == bulbId) {
        // we're not moving, just refreshing. do nothing.
    } else if (!activeBulbId) {
        // this is the initial state, so initialize.
        bulbHistory = [];
    } else {
        // we're in an actual state, so push the bulb into the history array.
        bulbHistory.push(activeBulb);

        // TODO: there should also be a mechanism for going 'back' into history,
        // which would have the effect of popping items off of bulbHistory.

        // also if we click on a bulb unrelated to the present bulb, this should
        // reset our history to the null array.
    }

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
        { // HISTORY and CENTER:
            // start by assembling the incoming history chain
            if (bulbHistory.length > 2)
                historyChain.push({ _id : "historyDummyNode",
                                    title : "..." });
            historyChain = historyChain.concat(
                bulbHistory.slice(bulbHistory.length-2,
                                  bulbHistory.length));
            historyChain.push(activeBulb);

            var i, j;
            for (i = historyChain.length; i >= 0; i--)
                for (j = i + 1; j < historyChain.length; j++) {
                    if (historyChain[i]._id == historyChain[j]._id) {
                        historyChain.splice(i, 1);
                        break;
                    }
                }

            // add those bulbs to the vertex collection
            graph.nodes = graph.nodes.concat(historyChain);

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
            $.getJSON('/bulb/' + activeBulbId + '/children',
                function(childBulbs) {
                    outgoingBulbs = outgoingBulbs.concat(childBulbs);
                    // insert them as vertices
                    var i;
                    for (i = 0; i < outgoingBulbs.length; i++)
                        graph.nodes = safelyAddBulbTo(outgoingBulbs[i],
                                                      graph.nodes);

                    // insert edges from the current bulb to the outgoing bulbs
                    outgoingBulbs.forEach(function (outBulb) {
                        graph.links.push({ source : activeBulbId,
                                           target : outBulb._id });

                        // filter edges from the outgoing bulbs to those bulbs
                        // which are part of the list of bulbs to display.
                        // if we can't find outOutBulb's id...
                        outBulb.outgoingNodes.forEach(function (outOutBulb) {
                            if (graph.nodes.filter(function(thisBulb) {
                                    return thisBulb._id == outOutBulb;
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
                });
            });
        }

        // update the active bulb info fields
        $('#bulbInfoTitle').val(response.title);
        $('#bulbInfoId').text(response._id);
        $('#bulbInfoType').text(response.type);
        $('#bulbInfoResolved')[0].checked = response.resolved;

        // for the contained nodes
        $("#bulbInfoContainsNodes").html('');
        $.getJSON('/bulb/' + activeBulbId + '/children', function (children) {
            $.each(children, function (child) {
                var listContent = '';
                listContent += '<li>';
                listContent += '<a href="#" class="linkShowBulb" rel="' +
                               this._id + '" title="Show details">' +
                               this.title + '</a>';
                listContent += '</li>';
                $("#bulbInfoContainsNodes").append(listContent);
            });
        });
        
        var date = new Date(response.modificationTime);
        $('#bulbInfoModificationTime').html(date.toLocaleDateString() +
            ',<br />' + date.toLocaleTimeString());

        if (response.parentWorkspace) {
            $.getJSON('/workspace/' + response.parentWorkspace,
                      function (workspace) {
                $('#bulbInfoParentsWorkspaceId').text(workspace.title);
            });
        } else {
            $('#bulbInfoParentsWorkspaceId').text('None.');
        }

        if (response.parentContainer) {
            $.getJSON('/bulb/' + response.parentContainer,
                      function (container) {
                $('#bulbInfoParentsContainerId').html('<a href="#" rel="' +
                    response.parentContainer + '" class="linkShowBulb">' +
                    container.title + '</a>');
            });
        } else {
            $('#bulbInfoParentsContainerId').text('None.');
        }

        if (response.parentOriginal) {
            $.getJSON('/bulb/' + response.parentOriginal + '/originalowner',
                    function (original) {
                $('#bulbInfoParentsOriginalId').html('<a href="#" ' +
                    'class="syncWithOriginal">' + original.name + '</a>');
            });
        } else {
            $('#bulbInfoParentsOriginalId').text('None.');
        }
        
        var sharesText = '';
        $.each(response.shares, function (index) {
            if (sharesText)
                sharesText += '\n';
            sharesText += response.shares[index];
        });
        $('#bulbInfoShares').val(sharesText);

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

        activeBulbId = '';
        activeBulb = {};

        if (bulbHistory.length > 0) {
            selectBulb(null, bulbHistory[bulbHistory.length-1]._id);
        } else {
            $.getJSON('/toplevel', function(data) {
                if (data.length > 0) {
                    activeBulb = {}; activeBulbId = '';
                    selectBulb(null, data[0]._id);
                }
            });
        }
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
    freshBulb.shares = $('#bulbInfoShares').val().split(/\n/);

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

        selectBulb(null, activeBulbId);
    });
};

function addLink(targetId) {
    // XXX: shouldn't be able to link to nodes which have us in their path.
    if ((targetId == activeBulbId) || // can't select ourselves
        (activeBulb.outgoingNodes.indexOf(targetId) > -1)) // can't repeat
        return;

    activeBulb.outgoingNodes.push(targetId);
    state = clickStates.SELECT;

    updateBulb(null);
}

function removeLink(targetId) {
    activeBulb.outgoingNodes = activeBulb.outgoingNodes.filter(function (b) {
        return (b != targetId);
    });

    state = clickStates.SELECT;
    updateBulb(null);
}

function pickParentWorkspace(event) {
    if (event)
        event.preventDefault();

    launchWorkspaceSelector(event.target, function (path) {
        if (!activeBulb || !path)
            return;

        activeBulb.parentWorkspace = path.workspace;

        updateBulb(null);
    });
}

function pickParentContainer(event) {
    if (event)
        event.preventDefault();

    launchPathSelector(event.target, function (path) {
        if (!activeBulb || !path)
            return;

        if (path.path.length == 0)
            activeBulb.parentContainer = '';
        else
            activeBulb.parentContainer = path.path.pop();

        updateBulb(null);
    });
}

function navigateClicked(event) {
    if (event)
        event.preventDefault();

    launchPathSelector(event.target, function (path) {
        if (!path)
            return;

        if (path.path.length == 0)
            return;

        $.getJSON('/bulb/' + path.path.pop(), function (bulb) {
            safelyAddBulbTo(bulb, graph.nodes);
            restartGraph();
        });
    });
}

function syncBulbWithOriginal(event) {
    if (event)
        event.preventDefault();

    var confirmation = confirm('Are you sure you want to synchronize the active bulb with its original?');

    if (confirmation === false) {
        return;
    }

    $.post('/bulb/' + activeBulbId + '/sync', function (response) {
        if (response.msg)
            alert('Error: ' + response.msg);
        
        selectBulb(null, activeBulbId);
    });
}

function duplicateNodeFn (event) {
    if (event)
        event.preventDefault();

    var nodeId = $('#duplicateNodeInput').val();

    $.post('/bulb/' + nodeId + '/copy', function (response) {
        if (response.msg) {
            alert('Error: ' + response.msg);
            return;
        }

        selectBulb(null, response._id);
    });
}
