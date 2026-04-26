import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import CLOUDS from 'vanta/dist/vanta.clouds.min'
import { motion } from 'framer-motion'
import frases from './data/frases'
import autores from './data/autores'
import './App.css'

function generarContenidoAleatorio() {
  const frase = frases[Math.floor(Math.random() * frases.length)]
  const autor = autores[Math.floor(Math.random() * autores.length)]

  return {
    texto: frase.texto,
    nombre: autor.nombre,
    imagen: autor.imagen
  }
}

function App() {
  const vantaRef = useRef(null)
  const clickAudioRef = useRef(null)

  const [vantaEffect, setVantaEffect] = useState(null)
  const [vantaReady, setVantaReady] = useState(false)
  const [contenido, setContenido] = useState(() => generarContenidoAleatorio())

  useEffect(() => {
    clickAudioRef.current = new Audio('/sounds/fino.mp3')
  }, [])

  const handleNuevaFrase = () => {
    if (clickAudioRef.current) {
      clickAudioRef.current.currentTime = 0
      clickAudioRef.current.play().catch(() => {})
    }

    setContenido(generarContenidoAleatorio())
  }

  useEffect(() => {
    if (!vantaEffect && vantaRef.current) {
      try {
        const threeInstance =
          typeof window !== 'undefined' && window.THREE ? window.THREE : THREE

        const effect = CLOUDS({
          el: vantaRef.current,
          THREE: threeInstance,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
        })

        setVantaEffect(effect)
        setVantaReady(true)
      } catch (error) {
        console.error('Vanta init error:', error)
        setVantaReady(false)
      }
    }

    return () => {
      if (vantaEffect) vantaEffect.destroy()
    }
  }, [vantaEffect])

  return (
    <div className="app">
      <div className={`bg ${!vantaReady ? 'bg-fallback' : ''}`} ref={vantaRef}></div>

      <img
        src="/img/logo2.png"
        alt="Logo"
        className="logo"
      />

      <div className="content">
        <motion.h1
          key={contenido.texto}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="frase"
        >
          “{contenido.texto}”
        </motion.h1>

        <motion.h2
          key={contenido.nombre}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="autor"
        >
          — {contenido.nombre}
        </motion.h2>

        <motion.img
          key={contenido.imagen}
          src={contenido.imagen}
          alt={contenido.nombre}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="autor-img"
        />

        <button
          className="boton-frase"
          onClick={handleNuevaFrase}
        >
          Siguiente frase inspiradora 😍
        </button>
      </div>
    </div>
  )
}

export default App
