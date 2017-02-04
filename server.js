const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')
const config = require('./webpack.config')
const express = require('express')

var database = {
  'hello':{
    pattern: x => /@BEGIN/.test(x),
    logic: () => '반가워요~'
  },
  '인사': {
    pattern: x => /안녕/.test(x),
    logic: () => '안녕하세요!'
  },
  '공격': {
    pattern: x => /(공격)|(때려)|(잡아)|(자바)/.test(x),
    logic: () => '알겠어요! 공격!'
  },
  '도움': {
    pattern: x => /(도와)|(도움)/.test(x),
    logic: () => '도와드릴께요!'
  },
  '후퇴': {
    pattern: x => /(물러나)|(후퇴)|(숨어)/.test(x),
    logic: () => '일단 물러날께요!'
  },
  '헬프': {
    pattern: x => /(할 수)|(할 줄)/.test(x),
    logic: () => `제가 할 줄 아는 건, ${_.without(_.keys(database), 'fallback').join(', ')}이에요.`
  },
  'fallback': {
    pattern: x => true,
    logic: (context) => `${context.sentence}라고요? 잘 모르겠어요.`
  }
}

function process(msg) {
  var text = msg.text

  for (var k in database) {
    var v = database[k]
    if (v.pattern(text)) {
      return Promise.resolve({
        intent: k,
        text: v.logic({ sentence: text })
      })
    }
  }

  return Promise.reject(new Error("Unhandled"))
}

var app = express()
var bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.post('/api',(req,res) => {
  process(req.body)
    .then(json => {
      res.json(json)
    })
    .catch(e => res.send(JSON.stringify(e)))
})
app.listen(3000)

new WebpackDevServer(webpack(config), {
  publicPath: config.output.publicPath,
  hot: true,
  historyApiFallback: true,
  proxy: {
    "/api/*": "http://localhost:3000"
  }
}).listen(5000, '0.0.0.0', (err) => {
  if (err) {
    console.log(err);
  }
  console.log('Listening at 0.0.0.0:5000');
});
