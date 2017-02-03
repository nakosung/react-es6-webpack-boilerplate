import React, { Component } from 'react'

import Bootstrap from 'bootstrap/dist/css/bootstrap.css'
import _ from 'lodash'

class Recog extends Component {
  constructor(props) {
    super(props)
    this.state = { listening: false }
  }

  componentDidMount() {
    var recognition = new webkitSpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let interim_transcript = ''
      let confidence = 1.0
      for (var i = event.resultIndex; i < event.results.length; ++i) {
        let r = event.results[i]
        if (r.isFinal) {
          this.props.onAppend(r[0].transcript)
        } else {
          interim_transcript += r[0].transcript
          confidence *= r[0].confidence
        }
      }
      this.props.onPeek(interim_transcript, confidence)
    }
    recognition.onerror = e => {
      console.error(e)
    }
    recognition.onend = () => {
      this.setState({ listening: false })
      setTimeout(() => recognition.start(), 250)
    }
    recognition.onstart = () => {
      this.setState({ listening: true })
    }
    recognition.start()
  }

  render() {
    return <div>
      음성 인식 상태: {this.state.listening ? '듣고 있습니다' : '듣지 못하고 있습니다'}
    </div>
  }
}

class TTS extends Component {
  constructor(props) {
    super(props)
    this.state = {}
  }
  loadVoices() {
    let voices = speechSynthesis.getVoices()
    this.setState({ voices: voices })
  }
  componentDidMount() {
    this.loadVoices()
    window.speechSynthesis.onvoiceschanged = () => this.loadVoices()
    this.setState({ text: 'hello' })
  }
  speak(text) {
    let msg = new SpeechSynthesisUtterance()

    msg.text = text

    msg.volume = 1.0
    msg.rate = 1.0
    msg.pitch = 1.0

    //msg.voice = speechSynthesis.getVoices().filter(function(voice) { return voice.name == voiceSelect.value; })[0];

    // Queue this utterance.
    window.speechSynthesis.speak(msg)
  }
  render() {
    return <div />
  }
}

class Chat extends Component {
  constructor(props) {
    super(props)
    this.state = { lines: [] }
  }

  push(line) {
    let lines = this.state.lines
    lines.push({
      id: lines.length,
      user: line.user,
      msg: line.msg
    })
    this.setState({ lines: lines })
  }

  render() {
    return <div>
      {this.state.lines.map(line => <Line key={line.id} user={line.user} msg={line.msg} />)}
    </div>
  }
}

class Line extends Component {
  render() {
    let {user, msg, interim, confidence} = this.props
    interim = interim || ''
    return <p className={user == 'AI' ? 'text-danger well well-sm' : 'well well-sm'}>
      {user} : {msg} {interim != '' ?
        <span style={{ 'color': '#aaa' }}>{interim} ({(confidence * 100).toFixed(1)}%)</span>
        : <span />
      }
    </p>
  }
}

let database = {
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

class Chatbot extends Component {
  constructor(props) {
    super(props)

    this.state = { intent: '' }
  }
  listen(msg) {
    let {text} = msg

    for (let k in database) {
      let v = database[k]
      if (v.pattern(text)) {
        this.setState({ intent: k })
        this.say(v.logic({ sentence: text }))
        break
      }
    }
  }
  componentDidMount() {
    setTimeout(() => this.say("안녕하세요"), 500)
  }
  say(text) {
    this.props.onSay(text)
  }
  render() {
    return <p>
      파악한 의도: {this.state.intent}
    </p>
  }
}

export default class App extends Component {
  constructor(props) {
    super(props)
    this.state = { text: '', interim: '', user: '유저', ai: 'AI' }
    this.textToKill = ''
  }
  peek(text, confidence) {
    this.setState({ interim: text, confidence: confidence })
    this.cancelAutoComplete()
    if (confidence > 0.8 && text != '') {
      this.timer = setTimeout(() => {
        this.peek('', 0)
        this.append(text)
        this.textToKill += text
      }, 250)
    }
  }
  cancelAutoComplete() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
  append(text) {
    if (this.textToKill == text) {
      this.textToKill = ''
      return
    }
    this.cancelAutoComplete()
    this.setState({ text: this.state.text + text })
    this.chat.push({ user: this.state.user, msg: text })
    this.bot.listen({ user: this.state.user, text: text })
    this.setState({ text: '' })
  }
  say(text) {
    this.chat.push({ user: this.state.ai, msg: text })
    this.tts.speak(text)
  }
  componentWillUnmount() {
    this.cancelAutoComplete()
  }
  render() {
    return (
      <div className='container' style={{ padding: 10 }}>
        <h1>음성 인식 챗봇 데모</h1>
        <Chatbot ref={e => this.bot = e} onSay={this.say.bind(this)} />
        <TTS ref={e => this.tts = e} />
        <Recog onPeek={this.peek.bind(this)} onAppend={this.append.bind(this)} />
        <Chat ref={e => this.chat = e} />
        {this.state.text != '' || this.state.interim != '' ?
          <Line
            user={this.state.user}
            msg={this.state.text}
            interim={this.state.interim}
            confidence={this.state.confidence}
          />
          : <p />
        }
      </div>
    );
  }
}
