var fs = require('fs')
var test = require('tape')
var Pbf = require('pbf')
var geojsonVt = require('geojson-vt')
var VectorTile = require('vector-tile').VectorTile
var GeoJsonEquality = require('geojson-equality')
var eq = new GeoJsonEquality({ precision: 1 })

var serialize = require('../')

test('geojson-vt tiles', function (t) {
  var orig = JSON.parse(fs.readFileSync(__dirname + '/fixtures/rectangle.geojson'))
  var tileindex = geojsonVt(orig)
  var tile = tileindex.getTile(1, 0, 0)

  var buff = serialize.fromGeojsonVt(tile, 'geojsonLayer')

  // make sure it parses correctly in vector-tile-js
  var tile3 = new VectorTile(new Pbf(buff))
  var out = tile3.layers['geojsonLayer'].feature(0).toGeoJSON(0, 0, 1)

  t.ok(eq.compare(orig, out), 'serializing and deserializing yields equivalent geojson')
  t.end()
})

test('vector-tile-js tiles', function (t) {
  var data = fs.readFileSync(__dirname + '/fixtures/rectangle-1.0.0.pbf')
  var tile = new VectorTile(new Pbf(data))
  var orig = tile.layers['geojsonLayer'].feature(0).toGeoJSON(0, 0, 1)

  var buff = serialize.fromVectorTileJs(tile)

  var tile3 = new VectorTile(new Pbf(buff))
  var out = tile3.layers['geojsonLayer'].feature(0).toGeoJSON(0, 0, 1)

  t.ok(eq.compare(orig, out), 'serializing and deserializing yields equivalent geojson')
  t.end()
})
