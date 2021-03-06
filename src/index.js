import path from 'path'
import {createHash} from 'crypto'
import rtlcss from 'rtlcss'
import {ConcatSource} from 'webpack-sources'
import cssDiff from '@romainberger/css-diff'
import {forEachOfLimit} from 'async'
import cssnano from 'cssnano'

const WebpackRTLPlugin = function(options = {filename: false, options: {}}) {
  this.options = options
}

WebpackRTLPlugin.prototype.apply = function(compiler) {
  compiler.plugin('emit', (compilation, callback) => {
    forEachOfLimit(compilation.chunks, 5, (chunk, key, cb) => {
      var rtlFiles = [],
          cssnanoPromise = Promise.resolve()

      chunk.files.forEach((asset) => {
        if (path.extname(asset) === '.css') {
          const baseSource = compilation.assets[asset].source()
          let rtlSource = rtlcss.process(baseSource, this.options.options)
          let filename

          if (this.options.filename) {
            filename = this.options.filename

            if (/\[contenthash\]/.test(this.options.filename)) {
              const hash = createHash('md5').update(rtlSource).digest('hex').substr(0, 10)
              filename = filename.replace('[contenthash]', hash)
            }
          }
          else {
            filename = `${path.basename(asset, '.css')}.rtl.css`
          }

          if (this.options.diffOnly) {
            rtlSource = cssDiff(baseSource, rtlSource)
          }

          if (this.options.minify !== false) {
            let nanoOptions = {}
            if (typeof this.options.minify === 'object') {
              nanoOptions = this.options.minify
            }

            cssnanoPromise = cssnanoPromise.then(() => {
              return cssnano.process(rtlSource, nanoOptions).then(output => {
                compilation.assets[filename] = new ConcatSource(output.css)
                rtlFiles.push(filename)
              });
            })
          }
          else {
            compilation.assets[filename] = new ConcatSource(rtlSource)
            rtlFiles.push(filename)
          }
        }
      })

      cssnanoPromise.then(() => {
        chunk.files.push.apply(chunk.files, rtlFiles)
        cb()
      })
    }, callback)
  })
}

module.exports = WebpackRTLPlugin
