import { useEffect, useMemo, useRef, useState } from 'react'
import CLOUDS from 'vanta/dist/vanta.clouds.min'
import { motion } from 'framer-motion'
import frasesBase from './data/frases'
import autores from './data/autores'
import { supabase } from './lib/supabase'
import './App.css'

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function generarContenidoAleatorio(poolFrases) {
  const frase = randomItem(poolFrases)
  const autor = randomItem(autores)

  return {
    texto: frase?.texto || 'La inspiración te está buscando.',
    nombre: autor.nombre,
    imagen: autor.imagen,
  }
}

function App() {
  const vantaRef = useRef(null)
  const clickAudioRef = useRef(null)

  const [vantaEffect, setVantaEffect] = useState(null)
  const [vantaReady, setVantaReady] = useState(false)
  const [frasesComunidad, setFrasesComunidad] = useState([])
  const [nuevaFrase, setNuevaFrase] = useState('')
  const [estadoEnvio, setEstadoEnvio] = useState({ tipo: '', mensaje: '' })

  const poolFrases = useMemo(
    () => [...frasesBase, ...frasesComunidad.map((f) => ({ texto: f.texto }))],
    [frasesComunidad]
  )

  const [contenido, setContenido] = useState(() => generarContenidoAleatorio(frasesBase))

  useEffect(() => {
    clickAudioRef.current = new Audio('/sounds/fino.mp3')
  }, [])

  const handleNuevaFrase = () => {
    if (clickAudioRef.current) {
      clickAudioRef.current.currentTime = 0
      clickAudioRef.current.play().catch(() => {})
    }

    setContenido(generarContenidoAleatorio(poolFrases))
  }

  useEffect(() => {
    async function cargarFrasesComunidad() {
      if (!supabase) {
        console.warn('Supabase no configurado: usando solo frases locales.')
        return
      }

      const { data, error } = await supabase
        .from('frases_comunidad')
        .select('id, texto, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error cargando frases de comunidad:', error)
        return
      }

      setFrasesComunidad(data || [])
    }

    cargarFrasesComunidad()
  }, [])

  useEffect(() => {
    setContenido(generarContenidoAleatorio(poolFrases))
  }, [poolFrases])

  async function handleAgregarFrase(e) {
    e.preventDefault()

    const texto = nuevaFrase.trim()
    if (!texto) {
      setEstadoEnvio({ tipo: 'error', mensaje: 'Escribe una frase antes de enviar.' })
      return
    }

    const existe = poolFrases.some((f) => f.texto.toLowerCase() === texto.toLowerCase())
    if (existe) {
      setEstadoEnvio({ tipo: 'error', mensaje: 'Esa frase ya existe. Prueba otra ✨' })
      return
    }

    if (!supabase) {
      setEstadoEnvio({
        tipo: 'error',
        mensaje: 'Falta configurar Supabase en variables de entorno.',
      })
      return
    }

    const { data, error } = await supabase
      .from('frases_comunidad')
      .insert([{ texto }])
      .select('id, texto, created_at')
      .single()

    if (error) {
      console.error('Error insertando frase:', error)
      setEstadoEnvio({ tipo: 'error', mensaje: 'No se pudo guardar. Inténtalo otra vez.' })
      return
    }

    setFrasesComunidad((prev) => [data, ...prev])
    setNuevaFrase('')
    setEstadoEnvio({ tipo: 'ok', mensaje: 'Frase enviada con éxito 🙌' })
  }

  useEffect(() => {
    if (!vantaEffect && vantaRef.current) {
      try {
        const cloudsFactory =
          typeof CLOUDS === 'function'
            ? CLOUDS
            : typeof CLOUDS?.default === 'function'
              ? CLOUDS.default
              : null

        if (!cloudsFactory) {
          throw new Error('Vanta CLOUDS factory inválido (export no es función).')
        }

        if (typeof window !== 'undefined' && !window.THREE) {
          throw new Error('window.THREE no está disponible para Vanta.')
        }

        const effect = cloudsFactory({
          el: vantaRef.current,
          THREE: window.THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          backgroundColor: 0xf0e8de,
          skyColor: 0x9a87f0,
          cloudColor: 0x6378be,
          sunColor: 0x342311,
          sunGlareColor: 0xeb400a,
          sunlightColor: 0x89837d,
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

        <button className="boton-frase" onClick={handleNuevaFrase}>
          Siguiente frase inspiradora 😍
        </button>

        <form className="frase-form" onSubmit={handleAgregarFrase}>
          <label htmlFor="nueva-frase">Comparte tu frase inspiradora</label>
          <textarea
            id="nueva-frase"
            value={nuevaFrase}
            onChange={(e) => setNuevaFrase(e.target.value)}
            placeholder="Escribe aquí tu frase..."
            maxLength={220}
          />
          <button type="submit" className="boton-frase boton-secundario">
            Enviar frase a la comunidad
          </button>
          {estadoEnvio.mensaje ? (
            <p className={`estado-envio ${estadoEnvio.tipo}`}>{estadoEnvio.mensaje}</p>
          ) : null}
        </form>
      </div>
    </div>
  )
}

export default App
