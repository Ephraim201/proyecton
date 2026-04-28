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
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [seccionActiva, setSeccionActiva] = useState('frases')

  const frasesAprobadas = useMemo(
    () => frasesComunidad.filter((f) => f.estado === 'approved'),
    [frasesComunidad]
  )

  const frasesPendientes = useMemo(
    () => frasesComunidad.filter((f) => f.estado === 'pending'),
    [frasesComunidad]
  )

  const poolFrases = useMemo(
    () => [...frasesBase, ...frasesAprobadas.map((f) => ({ texto: f.texto }))],
    [frasesAprobadas]
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
        .select('id, texto, likes, dislikes, estado, created_at')
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
      .insert([{ texto, likes: 0, dislikes: 0, estado: 'pending' }])
      .select('id, texto, likes, dislikes, estado, created_at')
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

  async function handleVotar(frase, tipo) {
    if (!supabase || frase.estado !== 'pending') return

    const nuevosLikes = tipo === 'like' ? (frase.likes || 0) + 1 : frase.likes || 0
    const nuevosDislikes = tipo === 'dislike' ? (frase.dislikes || 0) + 1 : frase.dislikes || 0

    let nuevoEstado = 'pending'
    if (nuevosLikes >= 50) nuevoEstado = 'approved'
    if (nuevosDislikes >= 50) nuevoEstado = 'rejected'

    const { data, error } = await supabase
      .from('frases_comunidad')
      .update({ likes: nuevosLikes, dislikes: nuevosDislikes, estado: nuevoEstado })
      .eq('id', frase.id)
      .select('id, texto, likes, dislikes, estado, created_at')
      .single()

    if (error) {
      console.error('Error al votar frase:', error)
      return
    }

    setFrasesComunidad((prev) => prev.map((item) => (item.id === data.id ? data : item)))
  }

  function cambiarSeccion(seccion) {
    setSeccionActiva(seccion)
    setMenuAbierto(false)
  }

  return (
    <div className="app">
      <div className={`bg ${!vantaReady ? 'bg-fallback' : ''}`} ref={vantaRef}></div>

      <button
        className="menu-toggle"
        aria-label="Abrir menú"
        onClick={() => setMenuAbierto((prev) => !prev)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <aside className={`sidebar ${menuAbierto ? 'open' : ''}`}>
        <button
          className={`menu-item ${seccionActiva === 'frases' ? 'active' : ''}`}
          onClick={() => cambiarSeccion('frases')}
        >
          Frases inspiradoras
        </button>
        <button
          className={`menu-item ${seccionActiva === 'votar' ? 'active' : ''}`}
          onClick={() => cambiarSeccion('votar')}
        >
          Votar frases inspiradoras
        </button>
        <button
          className={`menu-item ${seccionActiva === 'crear' ? 'active' : ''}`}
          onClick={() => cambiarSeccion('crear')}
        >
          Crear frase inspiradora
        </button>
      </aside>

      {menuAbierto ? <div className="overlay" onClick={() => setMenuAbierto(false)} /> : null}

      <img
        src="/img/logo2.png"
        alt="Logo"
        className="logo"
      />

      <div className="content">
        {seccionActiva === 'frases' ? (
          <>
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
          </>
        ) : null}

        {seccionActiva === 'votar' ? (
          <div className="seccion-votar">
            <h1>Votar frases inspiradoras</h1>
            {frasesPendientes.length ? (
              <div className="votar-lista">
                {frasesPendientes.map((frase) => (
                  <article key={frase.id} className="votar-card">
                    <p className="votar-texto">“{frase.texto}”</p>
                    <p className="votar-contadores">
                      👍 {frase.likes || 0} · 👎 {frase.dislikes || 0}
                    </p>
                    <div className="votar-acciones">
                      <button
                        className="boton-frase boton-secundario"
                        onClick={() => handleVotar(frase, 'like')}
                      >
                        Like
                      </button>
                      <button
                        className="boton-frase boton-secundario"
                        onClick={() => handleVotar(frase, 'dislike')}
                      >
                        Dislike
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>No hay frases pendientes de votación ahora mismo.</p>
            )}
          </div>
        ) : null}

        {seccionActiva === 'crear' ? (
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
        ) : null}
      </div>
    </div>
  )
}

export default App
