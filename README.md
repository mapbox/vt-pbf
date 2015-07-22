# vt-pbf

Serialize [Mapbox vector tiles](https://github.com/mapbox/vector-tile-spec) to binary protobufs in javascript.

## Usage

As far as I know, the two places you might get a JS representation of a vector
tile are [geojson-vt](https://github.com/mapbox/geojson-vt) and [vector-tile-js](https://github.com/mapbox/vector-tile-js).  As these both use slightly different internal representations (and I'm not sure which ought to be considered the 'canonical' one), this this module has a method for deserializing each:

```javascript
var vtpbf = require('vt-pbf')

var orig = JSON.parse(fs.readFileSync(__dirname + '/fixtures/rectangle.geojson'))
var tileindex = geojsonVt(orig)
var tile = tileindex.getTile(1, 0, 0)

var buff = vtpbf.fromGeojsonVt(tile, 'geojsonLayer')
fs.writeFileSync('my-tile.pbf', buff)
```

```javascript
var vtpbf = require('vt-pbf')

var data = fs.readFileSync(__dirname + '/fixtures/rectangle-1.0.0.pbf')
var tile = new VectorTile(new Pbf(data))
var orig = tile.layers['geojsonLayer'].feature(0).toGeoJSON(0, 0, 1)

var buff = vtpbf.fromVectorTileJs(tile)
fs.writeFileSync('my-tile.pbf', buff)
```
