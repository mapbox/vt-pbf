var Pbf = require('pbf')
var vtpb = require('./vector-tile-pb')

module.exports = {
  fromGeojsonVt: fromGeojsonVt,
  fromVectorTileJs: fromVectorTileJs
}

/**
 * Serialize a vector-tile-js-created tile to pbf
 *
 * @param {Object} tile
 * @return {Buffer} uncompressed, pbf-serialized tile data
 */
function fromVectorTileJs (tile) {
  var layers = []
  for (var l in tile.layers) {
    var layer = tile.layers[l]
    layer.features = []
    // translate each feature object into the same from we get from
    // geosjon-vt
    for (var i = 0; i < layer.length; i++) {
      var feature = layer.feature(i)
      feature.tags = feature.properties
      feature.geometry = feature.loadGeometry()
        .map(function (ring) {
          return ring.map(function (point) {
            return [point.x, point.y]
          })
        })
      layer.features.push(feature)
    }
    prepareLayer(layer)
    layers.push(layer)
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
  var preparedLayers = []
  for (var layerName in layers) {
    var layer = layers[layerName]
    layer.name = layerName
    preparedLayers.push(layer)
    layer.features.forEach(function (feature) {
      if (feature.type === 1) {
        // Nest point geometry in an extra array, beacuse
        // encodeGeometry expects 'rings'
        // This will probably bite me later
        feature.geometry = [feature.geometry]
      }
    })
    prepareLayer(layer)
  }
  var out = new Pbf()
  vtpb.tile.write({ layers: preparedLayers }, out)
  return out.finish()
}

/**
 * Prepare the given layer to be serialized by the auto-generated pbf
 * serializer by encoding the feature geometry and tags.
 */
function prepareLayer (layer) {
  layer.name = layer.name || ''
  layer.version = layer.version || 1
  layer.extent = layer.extent || 4096
  layer.keys = []
  layer.values = []

  var keycache = {}
  var valuecache = {}

  layer.features.forEach(function (feature) {
    feature.geometry = encodeGeometry(feature.geometry)

    var tags = []
    for (var key in feature.tags) {
      var keyIndex = keycache[key]
      if (typeof keyIndex === 'undefined') {
        layer.keys.push(key)
        keyIndex = layer.keys.length - 1
        keycache[key] = keyIndex
      }
      var value = wrapValue(feature.tags[key])
      var valueIndex = valuecache[value.key]
      if (typeof valueIndex === 'undefined') {
        layer.values.push(value)
        valueIndex = layer.values.length - 1
        valuecache[value.key] = valueIndex
      }
      tags.push(keyIndex)
      tags.push(valueIndex)
    }

    feature.tags = tags
  })
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
  geometry.forEach(function (ring) {
    encoded.push(command(1, 1)) // moveto
    for (var i = 0; i < ring.length; i++) {
      if (i === 1) {
        encoded.push(command(2, ring.length - 1)) // lineto
      }
      var dx = ring[i][0] - x
      var dy = ring[i][1] - y
      encoded.push(zigzag(dx), zigzag(dy))
      x += dx
      y += dy
    }
  })

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
    if (value !== (value | 0)) {
      result = { float_value: value }
    } else if (value < 0) {
      result = { sint_value: value }
    } else {
      result = { uint_value: value }
    }
  } else {
    result = { string_value: '' + value }
  }

  result.key = type + ':' + value
  return result
}
