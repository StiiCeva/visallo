define([], function() {

    function PopoverHelper(node, cy) {
        if (!_.isElement(node) || !cy) {
            throw new Error('Invalid arguments');
        }
        this.node = node;
        this.cy = cy;
        this.$node = $(node);

        this.onViewportChangesForPositionChanges = this.onViewportChangesForPositionChanges.bind(this);
        this.onRegisterForPositionChanges = this.onRegisterForPositionChanges.bind(this);
        this.$node
            .on('registerForPositionChanges', this.onRegisterForPositionChanges)
            .on('unregisterForPositionChanges', this.onUnregisterForPositionChanges);
    }

    PopoverHelper.prototype.getCyNodeFromAnchor = function(anchorTo) {
        const cy = this.cy;
        if ('vertexId' in anchorTo) {
            return cy.getElementById(anchorTo.vertexId);
        }

        if ('edgeId' in anchorTo) {
            return cy.edges().filter(function(edge, edgeIndex) {
                return _.any(edge.data('edgeInfos'), function(edgeInfo) {
                    return edgeInfo.edgeId === anchorTo.edgeId;
                });
            })
        }

        if ('decorationId' in anchorTo) {
            return cy.getElementById(anchorTo.decorationId);
        }
    }

    PopoverHelper.prototype.destroy = function() {
        this.cy.removeListener('pan zoom position', this.onViewportChangesForPositionChanges);
        this.viewportPositionChanges = null;
        this.$node
            .off('registerForPositionChanges')
            .off('unregisterForPositionChanges');
    }

    PopoverHelper.prototype.onRegisterForPositionChanges = function(event, data) {
        const self = this;
        const cy = this.cy;
        const anchorTo = data && data.anchorTo;

        if (!anchorTo) {
            return console.error('Registering for position events requires an anchorTo config');
        }

        const anchorToCyElement = anchorTo.vertexId || anchorTo.edgeId || anchorTo.decorationId;
        const anchorToPage = anchorTo.page

        if (!anchorToCyElement && !anchorToPage) {
            return console.error('Registering for position events requires a vertexId, edgeId, page, or decorationId');
        }

        var cyNode = null;
        if (anchorToCyElement) {
            cyNode = this.getCyNodeFromAnchor(anchorTo);
            if (!cyNode || cyNode.length === 0) {
                return console.error('Could not find cyNode with anchorTo', anchorTo);
            }
        }

        event.stopPropagation();

        var offset = self.$node.offset(),
            cyPosition = anchorTo.page && cy.renderer().projectIntoViewport(
                anchorTo.page.x + offset.left,
                anchorTo.page.y + offset.top
            ),
            eventPositionDataForCyElement = function(cyElement) {
                if (cyElement.is('edge')) {
                    var connected = cyNode.connectedNodes(),
                        p1 = connected.eq(0).renderedPosition(),
                        p2 = connected.eq(1).renderedPosition(),
                        center = { x: (p1.x + p2.x) / 2 + offset.left, y: (p1.y + p2.y) / 2 + offset.top };

                    return {
                        position: center
                    };
                }

                var positionInNode = cyNode.renderedPosition(),
                    nodeOffsetNoLabel = cyNode.renderedOuterHeight() / 2,
                    nodeOffsetWithLabel = cyNode.renderedBoundingBox({ includeLabels: true }).h,
                    eventData = {
                        position: {
                            x: positionInNode.x + offset.left,
                            y: positionInNode.y + offset.top
                        }
                    };

                eventData.positionIf = {
                    above: {
                        x: eventData.position.x,
                        y: eventData.position.y - nodeOffsetNoLabel
                    },
                    below: {
                        x: eventData.position.x,
                        y: eventData.position.y - nodeOffsetNoLabel + nodeOffsetWithLabel
                    }
                };
                return eventData;
            };

        if (!self.viewportPositionChanges) {
            self.viewportPositionChanges = [];
            cy.on('pan zoom position', self.onViewportChangesForPositionChanges);
        }

        self.viewportPositionChanges.push({
            el: event.target,
            fn: function(el) {
                var eventData = {},
                    zoom = cy.zoom();
                if (anchorTo.vertexId || anchorTo.edgeId || anchorTo.decorationId) {
                    if (!cyNode.removed()) {
                        eventData = eventPositionDataForCyElement(cyNode);
                    }
                } else if (anchorTo.page) {
                    eventData.position = {
                        x: cyPosition[0] * zoom + cy.pan().x,
                        y: cyPosition[1] * zoom + cy.pan().y
                    };
                }
                eventData.anchor = anchorTo;
                eventData.zoom = zoom;
                $(el).trigger('positionChanged', eventData);
            }
        });

        self.onViewportChangesForPositionChanges();
    };

    PopoverHelper.prototype.onViewportChangesForPositionChanges = function() {
        var self = this;

        if (this.viewportPositionChanges) {
            this.viewportPositionChanges.forEach(function(vpc) {
                vpc.fn.call(self, vpc.el);
            })
        }
    };

    PopoverHelper.prototype.onUnregisterForPositionChanges = function(event, data) {
        var self = this,
            cy = this.cy;

        if (self.viewportPositionChanges) {
            var index = _.findIndex(self.viewportPositionChanges, function(vpc) {
                return vpc.el === event.target;
            })
            if (index >= 0) {
                self.viewportPositionChanges.splice(index, 1);
            }
            if (self.viewportPositionChanges.length === 0) {
                cy.removeListener('pan zoom position', self.onViewportChangesForPositionChanges);
                self.viewportPositionChanges = null;
            }
        }
    };

    return PopoverHelper;
});
