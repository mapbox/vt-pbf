var Pbf = require('pbf')
var vtpb = require('./vector-tile-pb')
var GeoJSONWrapper = require('./lib/geojson_wrapper')

module.exports = fromVectorTileJs
module.exports.fromVectorTileJs = fromVectorTileJs
module.exports.fromGeojsonVt = fromGeojsonVt
module.exports.GeoJSONWrapper = GeoJSONWrapper

/**
 * Serialize a vector-tile-js-created tile to pbf
 *
 * @param {Object} tile
 * @return {Buffer} uncompressed, pbf-serialized tile data
 */
function fromVectorTileJs (tile) {
  var layers = []
  for (var l in tile.layers) {
    layers.push(prepareLayer(tile.layers[l]))
  }

  var out = new Pbf()
  vtpb.tile.write({ layers: layers }, out)
  return out.finish()
}

/**
 * Serialized a geojson-vt-created tile to pbf.
 *
 * @param {Object} layers - An object mapping layer names to geojson-vt-created vector tile objects
 * @return {Buffer} uncompressed, pbf-serialized tile data
 */
function fromGeojsonVt (layers) {
  var l = {}
  for (var k in layers) {
    l[k] = new GeoJSONWrapper(layers[k].features)
    l[k].name = k
  }
  return fromVectorTileJs({layers: l})
}

/**
 * Prepare the given layer to be serialized by the auto-generated pbf
 * serializer by encoding the feature geometry and properties.
 */
function prepareLayer (layer) {
  var preparedLayer = {
    name: layer.name || '',
    version: layer.version || 1,
    extent: layer.extent || 4096,
    keys: [],
    values: [],
    features: []
  }

  var keycache = {}
  var valuecache = {}

  for (var i = 0; i < layer.length; i++) {
    var feature = layer.feature(i)
    feature.geometry = encodeGeometry(feature.loadGeometry())

    var tags = []
    for (var key in feature.properties) {
      var keyIndex = keycache[key]
      if (typeof keyIndex === 'undefined') {
        preparedLayer.keys.push(key)
        keyIndex = preparedLayer.keys.length - 1
        keycache[key] = keyIndex
      }
      var value = wrapValue(feature.properties[key])
      var valueIndex = valuecache[value.key]
      if (typeof valueIndex === 'undefined') {
        preparedLayer.values.push(value)
        valueIndex = preparedLayer.values.length - 1
        valuecache[value.key] = valueIndex
      }
      tags.push(keyIndex)
      tags.push(valueIndex)
    }

    feature.tags = tags
    preparedLayer.features.push(feature)
  }

  return preparedLayer
}

function command (cmd, length) {
  return (length << 3) + (cmd & 0x7)
}

function zigzag (num) {
  return (num << 1) ^ (num >> 31)
}

/**
 * Encode a polygon's geometry into an array ready to be serialized
 * to mapbox vector tile specified geometry data.
 *
 * @param {Array} Rings, each being an array of [x, y] tile-space coordinates
 * @return {Array} encoded geometry
 */
function encodeGeometry (geometry) {
  var encoded = []
  var x = 0
  var y = 0
  var rings = geometry.length
  for (var r = 0; r < rings; r++) {
    var ring = geometry[r]
    encoded.push(command(1, 1)) // moveto
    for (var i = 0; i < ring.length; i++) {
      if (i === 1) {
        encoded.push(command(2, ring.length - 1)) // lineto
      }
      var dx = ring[i].x - x
      var dy = ring[i].y - y
      encoded.push(zigzag(dx), zigzag(dy))
      x += dx
      y += dy
    }
  }

  return encoded
}

/**
 * Wrap a property value according to its type. The returned object
 * is of the form { xxxx_value: primitiveValue }, which is what the generated
 * protobuf serializer expects.
 */
function wrapValue (value) {
  var result
  var type = typeof value
  if (type === 'string') {
    result = { string_value: value }
  } else if (type === 'boolean') {
    result = { bool_value: value }
  } else if (type === 'number') {
    if (value % 1 !== 0) {
      result = { double_value: value }
    } else if (value < 0) {
      result = { sint_value: value }
    } else {
      result = { uint_value: value }
    }
  } else {
    value = JSON.stringify(value)
    result = { string_value: value }
  }

  result.key = type + ':' + value
  return result
}
