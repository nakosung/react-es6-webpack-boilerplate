import React, { Component } from 'react'
import ReactDOM from 'react-dom'

import Bootstrap from 'bootstrap/dist/css/bootstrap.css'
import _ from 'lodash'

class Recog extends Component {
  constructor(props) {
    super(props)
    this.state = { listening: false, active: true, speech: false, sound: false }
  }

  componentDidMount() {
    var recognition = new webkitSpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onsoundstart = () => this.setState({sound:true})
    recognition.onsoundend = () => this.setState({sound:false})
    recognition.onspeechstart = () => this.setState({speech:true})
    recognition.onspeechend = () => this.setState({speech:false})
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
      // this is not an error
      if (e.error == 'aborted') return

      console.error(e)
      recognition.onend()
    }
    recognition.onend = () => {
      this.setState({ listening: false })
    }
    recognition.onstart = () => {
      this.setState({ listening: true })
    }
    this.recognition = recognition
    this.interval = setInterval(() => {
      this.poll()
    },250)
  }

  poll() {
    if (this.state.active && !this.state.listening) {
      this.recognition.start()
    } else if (!this.state.active && this.state.listening) {
      this.recognition.abort()
    }
  }

  componentWillUnmount() {
    this.enable(false)
    clearInterval(this.interval)
  }

  enable(enable) {
    if (enable != this.state.active) {
      if (!enable) {
        this.setState({active:false})
      } else {
        this.setState({active:true})
      }
      this.poll()
    }
  }

  render() {
    return <div>
      <p>
        음성 인식 활성화: {this.state.active ? '켜짐' : '꺼짐'}
      </p>
      <p>
        음성 인식 상태: {this.state.listening ? '듣고 있습니다' : '듣지 못하고 있습니다'}
      </p>
      <p>
        Sound: {this.state.sound ? 'active' : '-'}
      </p>
      <p>
        Speech: {this.state.speech ? 'active' : '-'}
      </p>
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
    if (this.state.speaking) {
      return false
    }
    
    this.setState({speaking:true})
    let msg = new SpeechSynthesisUtterance()

    msg.text = text

    msg.volume = 1.0
    msg.rate = 1.0
    msg.pitch = 1.0

    this.props.onStart()

    let timer

    let done = () => {
      if (timer) {
        clearTimeout(timer)
      }
      this.setState({speaking:false})
      this.props.onStop()
    }
    timer = setTimeout(() => {
      timer = null
      msg.onend()
    }, 5000)

    msg.onend = done
    msg.onerror = (e) => {
      console.error('utterance',e)
      done()
    }

    //msg.voice = speechSynthesis.getVoices().filter(function(voice) { return voice.name == voiceSelect.value; })[0];

    // Queue this utterance.
    window.speechSynthesis.speak(msg)
  }
  render() {
    return <div>{this.state.speaking ? 'Speaking' : 'Mute'}</div>
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

class Chatbot extends Component {
  constructor(props) {
    super(props)

    this.state = { intent: '' }
  }
  listen(msg) {
    fetch('/api',{
      method: 'post',
      headers: new Headers({
	      'Content-Type': 'application/json'
      }),
      body: JSON.stringify(msg)
    })
    .then(response => response.json())
    .then(({intent,text}) => {
      this.setState({ intent: intent })
      this.say(text)
    })
    .catch(e => {
      console.error("Chatbot got an error: " + e)
    })
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
  componentDidMount() {
    this.bot.listen({ user: this.state.user, text: '@BEGIN' })
  }
  peek(text, confidence) {
    this.setState({ interim: text, confidence: confidence })
    this.cancelAutoComplete()
    if (confidence > 0.8 && text != '') {
      this.timer = setTimeout(() => {
        this.peek('', 0)
        this.append(text)
        this.textToKill = text
      }, 250)
    }

    this.scrollToBottom()
  }
  cancelAutoComplete() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
  append(text) {
    if (this.textToKill.length && text.indexOf(this.textToKill) >= 0) {
      console.log(text,this.textToKill)
      this.textToKill = ''
      return
    }
    this.textToKill = ''
    this.cancelAutoComplete()
    this.setState({ text: this.state.text + text })
    this.chat.push({ user: this.state.user, msg: text })
    this.bot.listen({ user: this.state.user, text: text })
    this.setState({ text: '' })

    this.scrollToBottom()
  }
  say(text) {
    this.chat.push({ user: this.state.ai, msg: text })
    this.tts.speak(text)

    this.scrollToBottom()
  }
  scrollToBottom() {
    const node = ReactDOM.findDOMNode(this.pane)
    node.scrollIntoView({behavior:'smooth'})
  }
  componentWillUnmount() {
    this.cancelAutoComplete()
  }
  render() {
    return (
      <div className='container' style={{ padding: 10 }}>
        <h1>음성 인식 챗봇 데모</h1>
        <p>사용자: {this.state.user}</p>
        <Chatbot ref={e => this.bot = e} onSay={this.say.bind(this)} />
        <TTS ref={e => this.tts = e} 
          onStart={() => this.stt.enable(false)}
          onStop={() => this.stt.enable(true)}
          />
        <Recog ref={e => this.stt = e} onPeek={this.peek.bind(this)} onAppend={this.append.bind(this)} />
        <div className='pre-scrollable'>
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
          <div ref={e => this.pane = e}/>
        </div>
      </div>
    );
  }
}
