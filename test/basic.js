var fs = require('fs')
var test = require('tape')
var Pbf = require('pbf')
var geojsonVt = require('geojson-vt')
var VectorTile = require('@mapbox/vector-tile').VectorTile
var GeoJsonEquality = require('geojson-equality')
var eq = new GeoJsonEquality({ precision: 1 })

var serialize = require('../')

test('geojson-vt tiles', function (t) {
  var orig = JSON.parse(fs.readFileSync(__dirname + '/fixtures/rectangle.geojson'))
  var tileindex = geojsonVt(orig)
  var tile = tileindex.getTile(1, 0, 0)

  var buff = serialize.fromGeojsonVt({
    'geojsonLayer': tile
  })

  // make sure it parses correctly in vector-tile-js
  var tile3 = new VectorTile(new Pbf(buff))
  var layer = tile3.layers['geojsonLayer']
  var features = []
  for (var i = 0; i < layer.length; i++) {
    var feat = layer.feature(i).toGeoJSON(0, 0, 1)
    features.push(feat)
  }

  t.plan(orig.features.length)
  orig.features.forEach(function (expected) {
    var actual = features.shift()
    t.ok(eq.compare(actual, expected))
  })
})

test('geojson-vt multipoint', function (t) {
  var orig = JSON.parse(fs.readFileSync(__dirname + '/fixtures/multi-points.json'))
  var tileindex = geojsonVt(orig)
  var tile = tileindex.getTile(1, 0, 0)

  var buff = serialize.fromGeojsonVt({
    'multipoint': tile
  })

  var tile3 = new VectorTile(new Pbf(buff))
  var layer = tile3.layers['multipoint']
  var features = []
  for (var i = 0; i < layer.length; i++) {
    var feat = layer.feature(i).toGeoJSON(0, 0, 1)
    features.push(feat)
  }

  t.plan(orig.features.length)
  orig.features.forEach(function (expected) {
    var actual = features.shift()
    t.ok(eq.compare(actual, expected))
  })
})

test('vector-tile-js tiles', function (t) {
  var data = fs.readFileSync(__dirname + '/fixtures/rectangle-1.0.0.pbf')
  var tile = new VectorTile(new Pbf(data))

  var buff = serialize(tile)
  var tile3 = new VectorTile(new Pbf(buff))

  var orig = tile.layers['geojsonLayer']
  t.plan(orig.length)

  var layer = tile3.layers['geojsonLayer']
  for (var i = 0; i < layer.length; i++) {
    var actual = orig.feature(i).toGeoJSON(0, 0, 1)
    var expected = layer.feature(i).toGeoJSON(0, 0, 1)
    t.ok(eq.compare(actual, expected))
  }
})

test('JSON.stringify non-primitive properties', function (t) {
  var orig = JSON.parse(fs.readFileSync(__dirname + '/fixtures/two-points.geojson'))

  var tileindex = geojsonVt(orig)
  var tile = tileindex.getTile(1, 0, 0)
  var buff = serialize.fromGeojsonVt({ 'geojsonLayer': tile })

  var vt = new VectorTile(new Pbf(buff))
  var layer = vt.layers['geojsonLayer']

  var first = layer.feature(0).properties
  var second = layer.feature(1).properties
  t.same(first.c, '{"hello":"world"}')
  t.same(first.d, '[1,2,3]')
  t.same(second.c, '{"goodbye":"mind"}')
  t.same(second.d, '{"hello":"world"}')
  t.equal(first.e, 39953616224)
  t.equal(first.f, 331.75415)
  t.end()
})

test('Pass through integer ids', function (t) {
  var orig = JSON.parse(fs.readFileSync(__dirname + '/fixtures/rectangle.geojson'))
  orig.features[1].id = 'Hello'
  var tileindex = geojsonVt(orig)
  var tile = tileindex.getTile(1, 0, 0)
  var buff = serialize.fromGeojsonVt({ 'geojsonLayer': tile })

  var vt = new VectorTile(new Pbf(buff))
  var layer = vt.layers['geojsonLayer']
  var feat0 = layer.feature(0)
  var feat1 = layer.feature(1)
  var feat2 = layer.feature(2)

  t.same(feat0.id, 123)
  t.notOk(feat1.id, 'Non-integer values should not be saved')
  t.notOk(feat2.id)

  t.end()
})

test('Pass options to fromGeojsonVt()', function (t) {
  var version = 2
  var extent = 8192
  var orig = JSON.parse(fs.readFileSync(__dirname + '/fixtures/rectangle.geojson'))
  var tileindex = geojsonVt(orig, { extent: extent })
  var tile = tileindex.getTile(1, 0, 0)
  var options = { version: version, extent: extent }
  var buff = serialize.fromGeojsonVt({ 'geojsonLayer': tile }, options)

  var vt = new VectorTile(new Pbf(buff))
  var layer = vt.layers['geojsonLayer']
  var features = []
  for (var i = 0; i < layer.length; i++) {
    var feat = layer.feature(i).toGeoJSON(0, 0, 1)
    features.push(feat)
  }

  t.equal(layer.version, options.version, 'version should be equal')
  t.equal(layer.extent, options.extent, 'extent should be equal')

  orig.features.forEach(function (expected) {
    var actual = features.shift()
    t.ok(eq.compare(actual, expected))
  })

  t.end()
})
