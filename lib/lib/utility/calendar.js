'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.minCellWidth = undefined;
exports.coordinateToTimeRatio = coordinateToTimeRatio;
exports.calculateXPositionForTime = calculateXPositionForTime;
exports.iterateTimes = iterateTimes;
exports.getMinUnit = getMinUnit;
exports.getNextUnit = getNextUnit;
exports.calculateDimensions = calculateDimensions;
exports.getGroupOrders = getGroupOrders;
exports.getGroupedItems = getGroupedItems;
exports.getVisibleItems = getVisibleItems;
exports.collision = collision;
exports.stack = stack;
exports.nostack = nostack;

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _generic = require('./generic');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function coordinateToTimeRatio(canvasTimeStart, canvasTimeEnd, canvasWidth) {
  return (canvasTimeEnd - canvasTimeStart) / canvasWidth;
}

function calculateXPositionForTime(canvasTimeStart, canvasTimeEnd, canvasWidth, time) {
  var widthToZoomRatio = canvasWidth / (canvasTimeEnd - canvasTimeStart);
  var timeOffset = time - canvasTimeStart;

  return timeOffset * widthToZoomRatio;
}

function iterateTimes(start, end, unit, timeSteps, callback) {
  var time = (0, _moment2.default)(start).startOf(unit);

  if (timeSteps[unit] && timeSteps[unit] > 1) {
    var value = time.get(unit);
    time.set(unit, value - value % timeSteps[unit]);
  }

  while (time.valueOf() < end) {
    var nextTime = (0, _moment2.default)(time).add(timeSteps[unit] || 1, unit + 's');
    callback(time, nextTime);
    time = nextTime;
  }
}

// this function is VERY HOT as its used in Timeline.js render function
// TODO: check if there are performance implications here
// when "weeks" feature is implemented, this function will be modified heavily

/** determine the current rendered time unit based on timeline time span
 *
 * zoom: (in milliseconds) difference between time start and time end of timeline canvas
 * width: (in pixels) pixel width of timeline canvas
 * timeSteps: map of timeDividers with number to indicate step of each divider
 */

// the smallest cell we want to render is 17px
// this can be manipulated to make the breakpoints change more/less
// i.e. on zoom how often do we switch to the next unit of time
// i think this is the distance between cell lines
var minCellWidth = exports.minCellWidth = 17;

function getMinUnit(zoom, width, timeSteps) {
  // for supporting weeks, its important to remember that each of these
  // units has a national progression to the other. i.e. a year is 12 months
  // a month is 24 days, a day is 24 hours.
  // with weeks this isnt the case so weeks needs to be handled specially
  var timeDividers = {
    second: 1000,
    minute: 60,
    hour: 60,
    day: 24,
    month: 30,
    year: 12
  };

  var minUnit = 'year';

  // this timespan is in ms initially
  var nextTimeSpanInUnitContext = zoom;

  Object.keys(timeDividers).some(function (unit) {
    // converts previous time span to current unit
    // (e.g. milliseconds to seconds, seconds to minutes, etc)
    nextTimeSpanInUnitContext = nextTimeSpanInUnitContext / timeDividers[unit];

    // timeSteps is "
    // With what step to display different units. E.g. 15 for minute means only minutes 0, 15, 30 and 45 will be shown."
    // how many cells would be rendered given this time span, for this unit?
    // e.g. for time span of 60 minutes, and time step of 1, we would render 60 cells
    var cellsToBeRenderedForCurrentUnit = nextTimeSpanInUnitContext / timeSteps[unit];

    // what is happening here? why 3 if time steps are greater than 1??
    var cellWidthToUse = timeSteps[unit] && timeSteps[unit] > 1 ? 3 * minCellWidth : minCellWidth;

    // for the minWidth of a cell, how many cells would be rendered given
    // the current pixel width
    // i.e. f
    var minimumCellsToRenderUnit = width / cellWidthToUse;

    if (cellsToBeRenderedForCurrentUnit < minimumCellsToRenderUnit) {
      // for the current zoom, the number of cells we'd need to render all parts of this unit
      // is less than the minimum number of cells needed at minimum cell width
      minUnit = unit;
      return true;
    }
  });

  return minUnit;
}

function getNextUnit(unit) {
  var nextUnits = {
    second: 'minute',
    minute: 'hour',
    hour: 'day',
    day: 'month',
    month: 'year'
  };

  return nextUnits[unit] || '';
}

function calculateDimensions(_ref) {
  var itemTimeStart = _ref.itemTimeStart,
      itemTimeEnd = _ref.itemTimeEnd,
      isDragging = _ref.isDragging,
      isResizing = _ref.isResizing,
      canvasTimeStart = _ref.canvasTimeStart,
      canvasTimeEnd = _ref.canvasTimeEnd,
      canvasWidth = _ref.canvasWidth,
      dragSnap = _ref.dragSnap,
      dragTime = _ref.dragTime,
      resizingEdge = _ref.resizingEdge,
      resizeTime = _ref.resizeTime;

  var itemStart = isResizing && resizingEdge === 'left' ? resizeTime : itemTimeStart;
  var itemEnd = isResizing && resizingEdge === 'right' ? resizeTime : itemTimeEnd;

  var x = isDragging ? dragTime : itemStart;

  var w = Math.max(itemEnd - itemStart, dragSnap);

  var collisionX = itemStart;
  var collisionW = w;

  if (isDragging) {
    if (itemTimeStart >= dragTime) {
      collisionX = dragTime;
      collisionW = Math.max(itemTimeEnd - dragTime, dragSnap);
    } else {
      collisionW = Math.max(dragTime - itemTimeStart + w, dragSnap);
    }
  }

  var ratio = 1 / coordinateToTimeRatio(canvasTimeStart, canvasTimeEnd, canvasWidth);

  var dimensions = {
    left: (x - canvasTimeStart) * ratio,
    width: Math.max(w * ratio, 3),
    collisionLeft: collisionX,
    originalLeft: itemTimeStart,
    collisionWidth: collisionW
  };

  return dimensions;
}

function getGroupOrders(groups, keys) {
  var groupIdKey = keys.groupIdKey;


  var groupOrders = {};

  for (var i = 0; i < groups.length; i++) {
    groupOrders[(0, _generic._get)(groups[i], groupIdKey)] = i;
  }

  return groupOrders;
}

function getGroupedItems(items, groupOrders) {
  var arr = [];

  // Initialize with empty arrays for each group
  for (var i = 0; i < Object.keys(groupOrders).length; i++) {
    arr[i] = [];
  }
  // Populate groups
  for (var _i = 0; _i < items.length; _i++) {
    if (items[_i].dimensions.order !== undefined) {
      arr[items[_i].dimensions.order].push(items[_i]);
    }
  }

  return arr;
}

function getVisibleItems(items, canvasTimeStart, canvasTimeEnd, keys) {
  var itemTimeStartKey = keys.itemTimeStartKey,
      itemTimeEndKey = keys.itemTimeEndKey;


  return items.filter(function (item) {
    return (0, _generic._get)(item, itemTimeStartKey) <= canvasTimeEnd && (0, _generic._get)(item, itemTimeEndKey) >= canvasTimeStart;
  });
}

var EPSILON = 0.001;

function collision(a, b, lineHeight) {
  var collisionPadding = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : EPSILON;

  // 2d collisions detection - https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection
  var verticalMargin = 0;

  return a.collisionLeft + collisionPadding < b.collisionLeft + b.collisionWidth && a.collisionLeft + a.collisionWidth - collisionPadding > b.collisionLeft && a.top - verticalMargin + collisionPadding < b.top + b.height && a.top + a.height + verticalMargin - collisionPadding > b.top;
}

function stack(items, groupOrders, lineHeight, force) {
  var i, iMax;
  var totalHeight = 0;

  var groupHeights = [];
  var groupTops = [];

  var groupedItems = getGroupedItems(items, groupOrders);

  if (force) {
    // reset top position of all items
    for (i = 0, iMax = items.length; i < iMax; i++) {
      items[i].dimensions.top = null;
    }
  }

  groupedItems.forEach(function (group) {
    // calculate new, non-overlapping positions
    groupTops.push(totalHeight);

    var groupHeight = 0;
    var verticalMargin = 0;
    for (i = 0, iMax = group.length; i < iMax; i++) {
      var item = group[i];
      verticalMargin = lineHeight - item.dimensions.height;

      if (item.dimensions.stack && item.dimensions.top === null) {
        item.dimensions.top = totalHeight + verticalMargin;
        groupHeight = Math.max(groupHeight, lineHeight);
        do {
          var collidingItem = null;
          for (var j = 0, jj = group.length; j < jj; j++) {
            var other = group[j];
            if (other.dimensions.top !== null && other !== item && other.dimensions.stack && collision(item.dimensions, other.dimensions, lineHeight)) {
              collidingItem = other;
              break;
            } else {
              // console.log('dont test', other.top !== null, other !== item, other.stack);
            }
          }

          if (collidingItem != null) {
            // There is a collision. Reposition the items above the colliding element
            item.dimensions.top = collidingItem.dimensions.top + lineHeight;
            groupHeight = Math.max(groupHeight, item.dimensions.top + item.dimensions.height - totalHeight);
          }
        } while (collidingItem);
      }
    }

    groupHeights.push(Math.max(groupHeight + verticalMargin, lineHeight));
    totalHeight += Math.max(groupHeight + verticalMargin, lineHeight);
  });
  return {
    height: totalHeight,
    groupHeights: groupHeights,
    groupTops: groupTops
  };
}

function nostack(items, groupOrders, lineHeight, force) {
  var i, iMax;

  var totalHeight = 0;

  var groupHeights = [];
  var groupTops = [];

  var groupedItems = getGroupedItems(items, groupOrders);

  if (force) {
    // reset top position of all items
    for (i = 0, iMax = items.length; i < iMax; i++) {
      items[i].dimensions.top = null;
    }
  }

  groupedItems.forEach(function (group) {
    // calculate new, non-overlapping positions
    groupTops.push(totalHeight);

    var groupHeight = 0;
    for (i = 0, iMax = group.length; i < iMax; i++) {
      var item = group[i];
      var verticalMargin = (lineHeight - item.dimensions.height) / 2;

      if (item.dimensions.top === null) {
        item.dimensions.top = totalHeight + verticalMargin;
        groupHeight = Math.max(groupHeight, lineHeight);
      }
    }

    groupHeights.push(Math.max(groupHeight, lineHeight));
    totalHeight += Math.max(groupHeight, lineHeight);
  });
  return {
    height: totalHeight,
    groupHeights: groupHeights,
    groupTops: groupTops
  };
}