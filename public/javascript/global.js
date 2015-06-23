// Settings ====================================================================

var width = 1000,
    height = 800,
    metaballThreshold = 300;

var smallRadius = 8;
var smallerBigRadius = 150;
var reallyBigRadius = 300;

var downsample = 0.25; // controls the quality of the workspace glow

var rerenderThreshold = 4; // counts in seconds

// Globals =====================================================================

var activeBulbId = '';
var activeBulb = {};
var activeBulbD3 = {};
var bulbHistory = [];

var clickStates = {
    SELECT : 'SELECT',
    LINKTO : 'LINKTO',
    DELINKTO : 'DELINKTO',
    LINKFROM : 'LINKFROM',
    DELINKFROM : 'DELINKFROM',
    POSSESS : 'POSSESS',
    DEPOSSESS : 'DEPOSSESS'
};
var state = clickStates.SELECT;
var panelState = 0;
var displayButton = {};

var svg = {};
var canvas = {},
    tempCanvas = {},
    tempCanvasElt = {};
var force = {};
var color = {};
var graph =
    {
        nodes : [],
        links : []
    };
var link = {};
var node = {};
var visibleWorkspaces = [];
var largeRadius = reallyBigRadius;

var debug = 0;

// DOM Ready ===================================================================

$(document).ready(function() {
    //// Set up the bulb graph

    d3.select('#divSVG')
        .attr('style',  'position:relative;' +
                        'width:' + width + 'px;' +
                        'height:' + height + 'px');

    // insert the drawing surface
    svg = d3.select('#divSVG')
        .insert('svg:svg', ':first-child')
            .attr('width', width)
            .attr('height', height);

    svg.append('rect')
        .attr('class', 'overlay')
        .attr('width', width)
        .attr('height', height);

    // the canvas background is used to display the metaball stuff
    canvas =
        d3.select('#divSVG')
            .insert("canvas", ":first-child")
                .attr('width', width)
                .attr('height', height)
                .node().getContext('2d');
    // we also need a background canvas to use as a scratch buffer
    tempCanvasElt = document.createElement("canvas");
    tempCanvasElt.width = width*downsample;
    tempCanvasElt.height = height*downsample;
    tempCanvas = tempCanvasElt.getContext("2d");

    // built-in physics simulator for automatic graph layout
    force = d3.layout.force()
              .charge(-180) // how forceful the repositioning is
              .linkDistance(largeRadius*1.5) // relaxed length of edge springs
              .friction(0.9)
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
    $('#panels').on('click', 'a.linkDeleteBulb', deleteBulb);

    // when the 'update' button is clicked, call the JS routine below
    $('#panels').on('click', 'a.linkUpdateBulb', updateBulb);

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

    // introduce toplevel nodes btuton
    $('a#toplevelButton').on('click', toplevelButtonFn);

    // jostle nodes button
    $('a#jostleButton').on('click', function (event) {
        if (event) event.preventDefault();
        node.each(function (d) { d.x = Math.random() * width;
                                 d.y = Math.random() * height;
                                 force.resume(); });
    });

    $('a#clearHistoryButton').on('click', function (event) {
        if (event) event.preventDefault();
        bulbHistory = [];
        selectBulb(null, activeBulbId);
    });
    setClickState(clickStates.SELECT)(null);

    // hook up the graph state buttons.
    // TODO: actually, this should probably *create* the buttons as well as hook
    // them up.
    for (var key in clickStates) {
        if (clickStates.hasOwnProperty(key)) {
            var stateName = clickStates[key];
            $('a#'+stateName+'Button').on('click', setClickState(stateName));
        }
    }

    // when new text is entered, make mathjax rerender it.
    $('textarea#bulbInfoText').on('keyup blur',
        function () { bulbTextNeedsRerender = 1; });

    // place the text renderer in the middle of the screen
    var rootDiv = $('div#panels'),
        rootOffset = rootDiv.offsetParent().offset();
    rootDiv
        .attr('style', 'overflow: auto; position: relative')
        .height(2*largeRadius - 25)
        .width(2*largeRadius - 10)
        .offset({
            top : (height/2 - largeRadius + rootOffset.top + 5),
            left : (width/2 - largeRadius + rootOffset.left + 5)
        });

    // place the resize button at the bottom-right of the node

    var resizeButton = $('#bulbInfoResize');
    resizeButton
        .attr('style', 'position: relative')
        .offset({
            top : (height/2 + largeRadius + rootOffset.top - 19),
            left: (width/2 + largeRadius + rootOffset.left - 12)
        });
    $('a#btnDisplayResize').on('click', resizeButtonFn);

    $('.divPanel').each(function (i, d) {
        if (i == panelState)
            $(this).css('display', 'inline');
        else
            $(this).css('display', 'none');

        $('#panelSelector').append('<a href="#" rel="' + i + '" ' +
            'class="panelSelectorButton"> • </a>');
    });
    $('a.panelSelectorButton').each(function (i, d) {
        if (i == 0)
            displayButton = this;

        if (i == panelState)
            $(this).css('color', 'black');
        else
            $(this).css('color', 'gray');
    });
    $('#panelSelector')
        .offset({top : (height/2 + largeRadius + rootOffset.top - 19),
                 left: (width/2) + rootOffset.left})
        .css('position', 'relative')
        .css("text-anchor", "middle");
    $('#panelSelector').on('click', 'a.panelSelectorButton',
        panelSelectorClick)

    // call MathJaX periodically to render the bulb text
    setInterval(rerenderBulbText, 1000);
});

// Utility functions ===========================================================

d3.selection.prototype.moveToFront = function() {
    return this.each(function() { this.parentNode.appendChild(this); });
};

function setClickState(newState) {
    return function (event) {
        if (event) event.preventDefault();

        // update the display
        $('a#'+state+'Button').removeClass('activeButton');
        $('a#'+newState+'Button').addClass('activeButton');

        // update the internal state
        state = newState;
    }
};

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

        case clickStates.LINKTO: {
            addLink(d._id);
            setClickState(clickStates.SELECT)(null);
            return;
        }

        case clickStates.DELINKTO: {
            removeLink(d._id);
            setClickState(clickStates.SELECT)(null);
            return;
        }

        case clickStates.LINKFROM: {
            addLinkFrom(d._id);
            setClickState(clickStates.SELECT)(null);
            return;
        }

        case clickStates.DELINKFROM: {
            removeLinkFrom(d._id);
            setClickState(clickStates.SELECT)(null);
            return;
        }

        case clickStates.POSSESS: {
            takePossession(d._id);
            setClickState(clickStates.SELECT)(null);
            return;
        }

        case clickStates.DEPOSSESS: {
            releasePossession(d._id);
            setClickState(clickStates.SELECT)(null);
            return;
        }

        default: {
            console.log("Unhandled click state!");
            return;
        }
    }
}

function constrainGraph () {
    // we have two kinds of geometric checks to do:
    // 1) collision checks, 2) boundary box checks.

    // returns {width: w, height: h}
    function getBounds(node) {
        if (node._id == activeBulbId) {
            return {width: largeRadius, height: largeRadius};
        } else {
            var textWidth = svg.selectAll("text").filter(function (d) {
                    return d == node;
                })[0][0].offsetWidth;
            return {width: textWidth/2, height: 2*smallRadius};
        }
    }

    function collide(node) {
        var nx1, ny1, nx2, ny2;
        var nbounds = getBounds(node);

        nx1 = node.x - nbounds.width;
        nx2 = node.x + nbounds.width;
        ny1 = node.y - nbounds.height;
        ny2 = node.y + nbounds.height;

        return function(quad, x1, y1, x2, y2) {
            if (quad.point && (quad.point !== node)) {
                var dx = node.x - quad.point.x,
                    adx = Math.abs(dx),
                    dy = node.y - quad.point.y,
                    ady = Math.abs(dy),
                    qbounds = getBounds(quad.point),
                    mdx = qbounds.width + nbounds.width,
                    mdy = qbounds.height + nbounds.height;
              
                /********  This part should be modified*********/
                if (adx < mdx  &&  ady < mdy) {          
                    var l = Math.sqrt(dx * dx + dy * dy);
            
                    var scalar = 0.05;
                    var lx = (adx - mdx) / l * 0.5 * scalar;
                    var ly = (ady - mdy) / l * 0.5 * scalar;
                    


                    // choose the direction with less overlap
                    if (lx > ly  &&  ly > 0) lx = 0;
                        else if (ly > lx  &&  lx > 0) ly = 0;


                    dx *= lx; dy *= ly;
                    node.x -= dx; node.y -= dy;
                    quad.point.x += dx; quad.point.y += dy;
                }
            }
            
            return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
        };
    }

    var q = d3.geom.quadtree(graph.nodes),
        i = 0,
        n = graph.nodes.length;

    while (++i < n) q.visit(collide(graph.nodes[i]));

    // now do the boundary box checks
    i = 0;
    while (++i < n) {
        var node = graph.nodes[i];
        if (node.x < 0)
            node.x = 0;
        else if (node.x > width)
            node.x = width;

        if (node.y < 0)
            node.y = 0;
        else if (node.y > height)
            node.y = height;
    }

    return;
}

function drawGraphCallback () {
    // start by working on the graph geometry
    constrainGraph();

    // clear the scratch canvas
    tempCanvas.clearRect(0, 0, width*downsample, height*downsample);
    canvas.clearRect(0, 0, width, height);

    // update edge positions
    link
        .attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });

    // update history node positions
    var shortHistory = bulbHistory.slice(-2).map(function (b) {
        return b._id;
    });

    node
        .each(function(d, i) {
            // if we're the highlighted node, then move us to the middle
            if (d._id == activeBulbId) {
                d.fixed = false;
                if (largeRadius == reallyBigRadius) {
                    d.x = d.px = width / 2;
                    d.y = d.py = height / 2;
                } else {
                    d.x = d.px = width / 5;
                    d.y = d.py = height / 5;
                }
                d.fixed = true;
                return;
            }

            // if we live in the history, then put us into the up-left chain
            if (d._id == 'historyDummyNode') {
                d.fixed = false;
                d.x = d.px = width / 30;
                d.y = d.py = height / 24;
                d.fixed = true;
                return;
            }
            
            // default:
            d.fixed = false;
            return;
        })
        .attr('transform', function (d) { // this actually updates the position.
            return "translate(" + d.x + "," + d.y + ")";
        });

    // show or don't show the text
    node.selectAll('text')
        .style('visibility', function (d) {
            if (d._id == activeBulbId)
                return "hidden";
            else
                return "visible";
        });

    // control node colors
    node.selectAll('rect')
        .style('fill', function (d) {
            if (d._id == activeBulbId)
                return 'white';

            if (shortHistory.indexOf(d._id) != -1 ||
                d._id == 'historyDummyNode')
                return '#4488ff';

            if (activeBulb.outgoingNodes &&
                activeBulb.outgoingNodes.indexOf(d._id) != -1)
                return 'green';

            // ideally this would not render any Search...-added nodes as blue,
            // since they aren't children.
            return 'blue';
        })
        .style('opacity', function (d) {
            if ((d._id == 'historyDummyNode' ||
                shortHistory.indexOf(d._id) != -1) &&
                (d._id != activeBulbId))
                return 0.3;
            return 1.0;
        })
        .each(function (d) {
            if (d._id === activeBulbId)
                d.radius = largeRadius;
            else
                d.radius = smallRadius;
        })
        .attr("x", function (d) { return -d.radius; })
        .attr("y", function (d) { return -d.radius; })
        .attr("rx", function (d) { return smallRadius; })
        .attr("ry", function (d) { return smallRadius; })
        .attr("width", function (d) { return 2*d.radius; })
        .attr("height", function (d) { return 2*d.radius; })
    //
    // draw the metaball layer
    //
        .each(function(d) {
            var radius = 6*(d.radius);

            var workspaceIndex = visibleWorkspaces.indexOf(d.pathData.workspace);
            if (workspaceIndex == -1) {
                // we don't belong to a workspace, so don't bother drawing.
                return;
            }
            
            // otherwise, we do belong to a workspace, so now grab a color index
            var color = d3.rgb(
                d3.scale.category10().domain(visibleWorkspaces)
                                        (d.pathData.workspace));
            var colorString = color.r + ', ' + color.g + ', ' + color.b;

            tempCanvas.beginPath();
            var grad = tempCanvas.createRadialGradient(
                d.x*downsample, d.y*downsample, 1,
                d.x*downsample, d.y*downsample, radius*downsample);
            grad.addColorStop(0, 'rgba(' + colorString + ', 1)');
            grad.addColorStop(1, 'rgba(' + colorString + ', 0)');
            tempCanvas.fillStyle = grad;
            tempCanvas.arc(d.x*downsample, d.y*downsample, radius*downsample,
                0, Math.PI*2);
            tempCanvas.fill();
        });

    // smear it into metaballs
    var imageData = tempCanvas.getImageData(
            0,0,width*downsample,height*downsample),
        pix = imageData.data;
    
    for (var i = 0, n = pix.length; i < n; i += 4) {
        if (pix[i + 3] < metaballThreshold) {
            pix[i + 3] /= 4;

            if (pix[i + 3] > metaballThreshold / 3)
                pix[i + 3] = 0;
        }
    }

    // post smeared data to the display canvas
    tempCanvas.putImageData(imageData, 0, 0);
    canvas.drawImage(tempCanvasElt, 0, 0, width, height);
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
                d.radius = smallRadius;
            });
    nodeg
        .append("rect") // set a bunch of default values
            .attr("x", function (d) { return -d.radius; })
            .attr("y", function (d) { return -d.radius; })
            .attr("rx", function (d) { return d.radius; })
            .attr("ry", function (d) { return d.radius; })
            .attr("width", function (d) { return 2*d.radius; })
            .attr("height", function (d) { return 2*d.radius; })
            .style("fill", "white")
            .style("stroke", "black")
            .attr("dx", 0)
            .attr("dy", 0);
    nodeg
        .append("text")
            .attr("dx", 0)
            .attr("dy", 2.5*smallRadius)
            .text(function (d) {
                return d.title;
            })
            .attr("text-anchor", "middle");

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
        .charge(function (d) {
            if (d._id == activeBulbId)
                return -2000;
            else
                return -180;
        })
        .linkDistance(function (d) {
            if (d.source._id == activeBulbId ||
                d.target._id == activeBulbId)
                return largeRadius*1.5;
            else
                return largeRadius/2;
        });

    link = link.data(graph.links); // we're going to reset the link data to this
    link.enter() // for all incoming links...
            .insert('line', ':first-child')
                .attr('class', 'link')
                .style('marker-end', 'url(#suit)'); // this draws arrowheads
    link.exit() // for all outgoing links...
            .remove();

    var t1 = node;
    var t2 = t1
        .filter(function (d) {
            return d._id == activeBulbId;
        });
    var t3 = t2
        .moveToFront();

    force
        .nodes(graph.nodes)
        .links(graph.links)
        .start();

    // update the collection of workspace color indices
    visibleWorkspaces = [];
    
    graph.nodes.forEach(function (d) {
        if (d.pathData.workspace != "" &&
            visibleWorkspaces.indexOf(d.pathData.workspace) == -1)
            visibleWorkspaces.push(d.pathData.workspace);
    });
}

var bulbTextNeedsRerender = 0;
var rerenderBulbText;
{
    var textSource = $('#bulbInfoText');
    var textTarget = $('#bulbInfoRenderedText');

    rerenderBulbText = function () {
        if (bulbTextNeedsRerender == 0 ||
            MathJax.Hub.Queue.pending)
            return;

        // we have to be edited but not-re-edited for threshold ticks before
        // we're willing to commit to a re-render.
        //
        if (bulbTextNeedsRerender < rerenderThreshold) {
            bulbTextNeedsRerender += 1;
            return;
        }

        bulbTextNeedsRerender = 0;

        var content = textSource.val();

        content = content.replace(/---/g, '—');
        content = content.replace(/--/g, '–');
        content = content.replace(/`/g, '');

        contentArray = content.split(/(\$.*\$|\\\[.*\\\])/);
        var markdownContent = '',
            mathjaxArray = [],
            index;
        for (index = 0; index < contentArray.length; index++) {
            if (index % 2 == 0) {
                // this is a markdown component
                markdownContent += contentArray[index];
            } else {
                // this is not a markdown component
                markdownContent += (' MATH' + ((index-1)/2) + 'NODE ');
                mathjaxArray.push(contentArray[index]);
            }
        }

        content = markdown.toHTML(markdownContent);
        for (index = 0; index < mathjaxArray.length; index++) {
            content = content.replace('MATH'+index+'NODE', mathjaxArray[index]);
        }

        content = '<p><strong>' + $('#bulbInfoTitle').val() + '</strong></p>' +
            '<div style="display:none"> $\\begingroup ' +
            activeBulb.virulentPreamble + ' ' + $('#bulbInfoPreamble').val() +
            '$</div>' + content +
            ' <div style="display:none">$\\endgroup$</div>';

        console.log(content);

        textTarget.html(content);
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, "bulbInfoRenderedText"]);

        return;
    }
}

function safelyAddBulbTo(bulb, array) {
    var i;

    for (i = 0; i < array.length; i++) {
        if (array[i]._id == bulb._id) {
            // array[i] = bulb; // XXX: I don't know if this is necessary.
            return array;
        }
    }

    array.push(bulb);
    return array;
}

// User-triggerable functions ==================================================

function resizeButtonFn(event) {
    if (event)
        event.preventDefault();

    largeRadius = (largeRadius == reallyBigRadius) ?
                        smallerBigRadius : reallyBigRadius;

    var transitioningToLarge = largeRadius == reallyBigRadius;

    // place the text renderer in the middle of the screen
    var renderedText = $('div#panels'),
        rootOffset = renderedText.offsetParent().offset();
    renderedText
        .attr('style', 'overflow: auto; position: relative')
        .height(2*largeRadius - 25)
        .width(2*largeRadius - 10)
        .offset({
            top : (height/(transitioningToLarge ? 2 : 5)
                    - largeRadius + rootOffset.top + 5),
            left : (width/(transitioningToLarge ? 2 : 5)
                    - largeRadius + rootOffset.left + 5)
        });

    // place the resize button at the bottom-right of the node

    var resizeButton = $('#bulbInfoResize');
    resizeButton
        .attr('style', 'position: relative')
        .offset({
            top : (height/(transitioningToLarge ? 2 : 5)
                    + largeRadius + rootOffset.top - 19),
            left: (width/(transitioningToLarge ? 2 : 5)
                    + largeRadius + rootOffset.left - 12)
        });

    $('#panelSelector')
        .offset({top : (height/(transitioningToLarge ? 2 : 5)
                    + largeRadius + rootOffset.top - 19),
                 left: width/(transitioningToLarge ? 2 : 5)
                    + rootOffset.left})
        .css('position', 'relative')
        .css("text-anchor", "middle");

    $('#bulbInfoText').attr('rows', largeRadius == reallyBigRadius ?
        20 : 10);

    restartGraph();
}

function panelSelectorClick(event) {
    if (event)
        event.preventDefault();

    panelState = $(this).attr('rel');
    $('.divPanel').each(function (i, d) {
        if (i == panelState) {
            $(this).css('display', 'inline');
        } else {
            $(this).css('display', 'none');
        }
    });

    $('a.panelSelectorButton').css('color', 'gray');
    $(this).css('color', 'black');

    return;
}

function toplevelButtonFn(event) {
    if (event)
        event.preventDefault();

    function addNodesWithoutEdges (bulbs) {
        // add them safely to the graph.
        bulbs.forEach(function (bulb) {
            safelyAddBulbTo(bulb, graph.nodes);
        });

        restartGraph();
    };

    launchWorkspaceSelector(event.target, function (path) {
        if (path.workspace) {
            // find the child nodes for this workspace.
            $.getJSON('/workspace/' + path.workspace + '/children',
                addNodesWithoutEdges);
        } else {
            // we picked the toplevel workspace. call /toplevel.
            $.getJSON('/toplevel', addNodesWithoutEdges);
        }
    });
}

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
    $.get('/bulb/' + activeBulbId, function(response) {
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
            if (bulbHistory.length > 0)
                historyChain.push({ _id : "historyDummyNode",
                                    title : "...",
                                    pathData : { workspace: '' }});
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
                function(outgoingNodes) {
            $.getJSON('/bulb/' + activeBulbId + '/children',
                function(childBulbs) {
                    outgoingNodes = outgoingNodes.concat(childBulbs);
                    // insert them as vertices
                    var i;
                    for (i = 0; i < outgoingNodes.length; i++)
                        graph.nodes = safelyAddBulbTo(outgoingNodes[i],
                                                      graph.nodes);

                    // insert edges from the current bulb to the outgoing bulbs
                    outgoingNodes.forEach(function (outBulb) {
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
        $('#bulbInfoVirulentPreamble').text(response.virulentPreamble ?
            response.virulentPreamble : '');
        $('#bulbInfoPreamble').val(response.preamble ? response.preamble : '');

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
            bulbTextNeedsRerender = Infinity;
            rerenderBulbText(); // cause an immediate re-render.

            $(displayButton).trigger('click');
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
    freshBulb.preamble = $('#bulbInfoPreamble').val();

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

    updateBulb(null);
}

function removeLink(targetId) {
    activeBulb.outgoingNodes = activeBulb.outgoingNodes.filter(function (b) {
        return (b != targetId);
    });

    updateBulb(null);
}

function addLinkFrom(targetBulbId) {
    if (targetBulbId == activeBulbId)
        return;

    $.getJSON('/bulb/' + targetBulbId, function (targetBulb) {
        if (targetBulb.msg)
            return;

        if (targetBulb.outgoingNodes.indexOf(activeBulbId) > -1)
            return;

        targetBulb.outgoingNodes.push(activeBulbId);
        $.ajax({
                type : 'PUT',
                url : '/bulb/' + targetBulbId,
                data : targetBulb,
                dataType : 'JSON'
            }).done(function (msg) {
                selectBulb(null, activeBulbId);
        });
    });
}

function removeLinkFrom(targetBulbId) {
    $.getJSON('/bulb/' + targetBulbId, function (targetBulb) {
        if (targetBulb.msg)
            return;

        var index = targetBulb.outgoingNodes.indexOf(activeBulbId);

        if (index == -1)
            return;

        targetBulb.outgoingNodes.splice(index,1);

        $.ajax({
                type : 'PUT',
                url : '/bulb/' + targetBulbId,
                data : targetBulb,
                dataType : 'JSON'
            }).done(function (msg) {
                selectBulb(null, activeBulbId);
        });
    });
}

function takePossession(targetBulbId) {
    if (targetBulbId == activeBulbId)
        return;

    $.getJSON('/bulb/' + targetBulbId, function (targetBulb) {
        if (targetBulb.msg)
            return;

        targetBulb.parentContainer = activeBulbId;

        $.ajax({
                type : 'PUT',
                url : '/bulb/' + targetBulbId,
                data : targetBulb,
                dataType : 'JSON'
            }).done(function (msg) {
                selectBulb(null, activeBulbId);
        });
    });
}

function releasePossession(targetBulbId) {
    if (targetBulbId == activeBulbId)
        return;
    
    $.getJSON('/bulb/' + targetBulbId, function (targetBulb) {
        if (targetBulb.msg)
            return;

        if (targetBulb.parentContainer != activeBulbId)
            return;

        if (activeBulb.parentContainer) {
            targetBulb.parentContainer = activeBulb.parentContainer;
        } else if (activeBulb.parentWorkspace && !targetBulb.parentWorkspace) {
            targetBulb.parentWorkspace = activeBulb.parentWorkspace;
        } else {
            targetBulb.parentWorkspace = '';
        }

        $.ajax({
                type : 'PUT',
                url : '/bulb/' + targetBulbId,
                data : targetBulb,
                dataType : 'JSON'
            }).done(function (msg) {
                selectBulb(null, activeBulbId);
        });
    });
    return;
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
