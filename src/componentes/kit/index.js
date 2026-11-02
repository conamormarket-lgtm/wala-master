export { default as Boton } from './Boton';
export { Etiqueta, Chip, Moneda, MONEDA, CostoMonedas, GananciaMonedas, SaldoMonedas, Contador } from './Etiquetas';
export { Campo, Buscador, Selector, SelectorTalla, SelectorColor, Cantidad, Interruptor, Casilla, CampoTelefono, CampoHex, Deslizador, normalizarHex } from './Formulario';
export { default as ListaOpciones } from './ListaOpciones';
export { PanelFlotante, enCelular } from './PanelFlotante';
export { CampoFecha, Calendario, fechaEnTexto } from './Fecha';
export { default as TarjetaProducto, TarjetaProductoEsqueleto, TarjetaDeCatalogo, soles } from './TarjetaProducto';
export { Cabecera, Pestanas, Logo } from './Navegacion';
export { BarraInferior } from './BarraInferior';
export { SeguimientoPedido, ItemCarrito, BarraEnvioGratis, ResumenPedido, PASOS_PEDIDO, ETAPAS_PRODUCCION } from './Pedido';
export { PantallaCarga, Cargando, CapaCargando, FRASES_CARGA } from './Cargando';
export { Hueso, EsqueletoTexto, EsqueletoCabeza, EsqueletoProducto, EsqueletoFila, EsqueletoPedido, EsqueletoTarjeta, EsqueletoFormulario, EsqueletoSeccion, EsqueletoPagina, FORMA_DE_SECCION, MODULOS_ESQUELETO_CUENTA } from './Esqueletos';
export { Aviso, ProveedorToasts, useToast, useNotificaciones, ListaNotificaciones, EstadoVacio, HojaInferior, Confirmar, ProveedorConfirmar, useConfirmar } from './Feedback';
export { EASE, RESORTE, useContador, seguirPuntero, Estallido, Revelar, esApp, useBloquearScroll, bloquearScroll, useCerrarConAtras } from './Efectos';
export { Enlace, ProveedorEnlaces } from './Enlace';
export { ProveedorTraduccion, useTexto, useHtml, Texto } from './Traduccion';
export { default as Desplegable } from './Desplegable';
export { MenuTienda, MenuMarcas, AyudaMonedas, MenuCuenta, VistaFavoritos, VistaCarrito } from './MenusCabecera';
export { default as AgregarRapido } from './AgregarRapido';
export { accionDeProducto, tarjetaDesdeProducto, esNuevo, opcionesDeProducto, rutaDeMarca, tarjetaDesdeMarca, testimonioDesdeAjuste, precioEfectivo, limitesDePrecio, esTemporada, gruposDeCatalogo, grillaDesdeConfiguracion, kapiDesdePerfil, retoDesdePerfil,
  sugerenciasDesdeBusqueda, grupoModalidad, ORDENES_BUSQUEDA, ordenarProductos, perfilDesdeUsuario, direccionDesdeFirestore, direccionAFirestore,
  recompensaDesdeFirestore, cuponDesdeFirestore, misionDesdeServidor, creacionDesdeDiseno, personaDesdeRecipient, personaARecipient,
  prendaEstudioDesde,
  fichaProductoDesde, opinionesDesde, itemCarritoDesde, itemRegaloDesde, fechaEntregaDesde, festivasDePersona, nivelesDesdeTiers, enlacePagoDesde, navDeMarca, identidadDeMarca, plantillaDeMarca, BLOQUES_MARCA, ESQUELETO_MARCA, portadaDeCombo, categoriasDeGrilla } from './adaptadores';
export { tipoDeEnlace } from './Enlace';
export { default as Carrusel } from './Carrusel';
export { default as Marquesina } from './Marquesina';
export { default as CuentaRegresiva } from './CuentaRegresiva';
export { default as Acordeon } from './Acordeon';
export { BloqueSeccion, TituloSeccion, tituloDesdeAjustes } from './Seccion';
export {
  BarraAnuncios, HeroCarrusel, InsigniasConfianza, CarruselProductos, OfertaRelampago,
  Testimonios, PreguntasFrecuentes, MarcasMarquesina, GrillaCategorias, REGISTRO_SECCIONES, RenderSecciones, SeccionDelKit,
} from './Secciones';
export { Encabezado, BloqueTexto, BloqueImagen, BloqueVideo, MosaicoBanners, FilaDestacados, videoIncrustado } from './SeccionesContenido';
export { BannerPrincipal, PortadaDeMarca, ListaBeneficios, Ubicacion, urlDeMapa, NavCategorias, GrillaProductos, CatalogoConFiltros } from './SeccionesExtra';
export { PiePagina, MarcoPie, ColumnasPie, TextoPie, ImagenPie } from './piezas/Pie';
export { default as PanelEditor, useBorrador, actualizarAjustes, insertarSeccion, moverSeccion, duplicarSeccion, quitarSeccion, nuevoIdSeccion } from './editor/PanelEditor';
export { SeccionEditable, InsertarAqui } from './editor/SeccionEditable';
export { FormularioSeccion, ProveedorEditor } from './editor/CamposEditor';
export { ESQUEMAS, ESQUEMAS_GLOBALES, GRUPOS_MODULOS, esquemaDe, ajustesIniciales, resumenDe } from './editor/esquemas';
export { EtiquetaColgante, IsoWala, LogoWala, Garabatos, Destello, Corazon, Puntos, Trazo, Sello, Visto } from './Marca';
export { IconoWala, ICONOS_WALA, iconoDesde } from './IconosWala';
export { PASTELES, pastel, ACENTOS, acento } from './Marca';
export * from './piezas';
export { MarcoTienda, PaginaTienda, productosDeSeccion, PaginaCarrito, PaginaMinijuegos, PaginaBusqueda } from './paginas/Paginas';
export { PaginaMarca } from './paginas/Marca';
export { TemaMarca, temaDeMarca } from './piezas/TemaMarca';
export { PortadaMarca } from './piezas/PortadaMarca';
export { PaginaPedidos, PaginaDetallePedido } from './paginas/CuentaPedidos';
export { MarcoCuenta, PaginaCuentaInvitado, PaginaResumenCuenta, PaginaPerfil, PaginaDirecciones, PaginaTarjetas, PaginaAjustes, validarDireccion, fechaLegible } from './paginas/Cuenta';
export { PaginaCatalogo, PaginaCupones, PaginaMisiones, PaginaReferidos } from './paginas/CuentaRecompensas';
export { PaginaCreaciones, PaginaListaDeseos, PaginaFechas } from './paginas/CuentaPersonalizacion';
export { PaginaEncuesta, GRUPOS_ENCUESTA, CONFIG_ENCUESTA } from './paginas/Encuesta';
export { MarcoAcceso, PaginaLogin, PaginaRecuperar } from './paginas/Acceso';
export { PaginaRegistro, PaginaCompletarPerfil } from './paginas/AccesoDatos';
export { PaginaCrear } from './paginas/Crear';
export { PaginaComunidad } from './paginas/Comunidad';
export { PaginaCreacion } from './paginas/Creacion';
export { PaginaVerDiseno, resumenDeDiseno } from './paginas/VerDiseno';
export { PaginaCombo } from './paginas/Combo';
export { PaginaEstudio } from './paginas/Estudio';
export { MarcoEstudio, InicioLienzoEstudio } from './paginas/MarcoEstudio';
export { capaEstudioDesde, cambiosDePanelEstudio } from './adaptadoresEstudio';
export { PaginaProducto } from './paginas/Producto';
export { PaginaCheckout } from './paginas/Checkout';
export { PaginaListaPublica, PaginaRegalar, PaginaRegaloSorpresa } from './paginas/Regalar';
export { PaginaPagoRapido } from './paginas/PagoRapido';
export { PaginaNoEncontrada, PaginaDescargarApp } from './paginas/Generales';
export { PaginaLegal } from './paginas/Legales';
export { PaginaReclamaciones, validarReclamacion } from './paginas/Reclamaciones';
export { PaginaPalabra, PaginaRuleta, PaginaBolitas } from './paginas/Juegos';
export { PaginaSorteo, PaginaSuscripcionSorteo } from './paginas/Sorteos';
export { PaginaSuscripciones, PaginaInvitacion, PaginaEnlaces } from './paginas/Campanas';
export { encuestaDesdeConfig } from './adaptadoresEncuesta';
export { juegosDelArcade, BANNERS_ARCADE } from './adaptadoresArcade';
export { prendaCrearDesdeProducto, comboCrearDesde, disenoComunidadDesde, fichaCreacionDesde } from './adaptadoresCrear';

// Panel administrativo (guia/ADMIN.md): la tienda no importa este índice.
export { MarcoAdmin, BarraInferiorAdmin, CabezaAdmin, SinPermiso, useMarcoAdmin } from './piezas/admin/Marco';
export { TablaAdmin, InsigniaEstado, ESTADOS_ADMIN, BarraFiltros, AccionesLote, CargarMas, ListaOrdenable, SelectorProductos, NumeroEnLinea } from './piezas/admin/Datos';
export { HojaEdicion, GrupoCampos, CampoImagen, CampoDinero, CampoColor, ElegirUno } from './piezas/admin/Formularios';
export { ICONOS_ADMIN, iconoAdmin } from './piezas/admin/iconosAdmin';
export { PaginaInicioAdmin } from './paginas/admin/Inicio';
export { PaginaListaAdmin } from './paginas/admin/Lista';
export { PaginaCategorias } from './paginas/admin/Categorias';
export { PaginaColecciones, PaginaAtributos, PaginaEnvios, PaginaCliparts } from './paginas/admin/Catalogo';
export { PaginaMarcas, PaginaProductosMarca } from './paginas/admin/Marcas';
export { PaginaDestacados } from './paginas/admin/Destacados';
export { PaginaProductos, PaginaInventario, PaginaRecomendar, PUBLICOS, EDADES } from './paginas/admin/Productos';
export { PaginaFichaProducto } from './paginas/admin/Ficha';
export { PaginaPersonalizables, PaginaPacks } from './paginas/admin/Crear';
export { PaginaBlueprints, PaginaPlantillasYoryo } from './paginas/admin/Herramientas';
export { PasoAdmin } from './piezas/admin/Pasos';
export { Cifra, FilaCifras, BloqueMetrica, ColumnasMetricas, SinDatos, SelectorPeriodo, ListaBarras } from './piezas/admin/Metricas';
export { ListaAvisos, TablaComparativa, ListaEnVivo, TarjetaEnlacesRotos, ListaInteresados } from './piezas/admin/Resultados';
export {
  MarcoResultados, PaginaResumenResultados, PaginaProductosResultados, PaginaVisitantesResultados, PaginaClientesResultados, PaginaOpinionesResultados,
  PaginaDetalleTecnico, PANTALLAS_TECNICAS,
} from './paginas/admin/Resultados';
export { FichaCliente, ListaCumpleanos } from './piezas/admin/Clientes';
export { PaginaPaginasTecnica, PaginaUsoTecnica, PaginaNavegadorTecnica, PaginaMapaDeCalor, ORIGENES_TECNICOS } from './paginas/admin/Tecnico';
export { PaginaReferidosAdmin, PaginaMisionesAdmin, PaginaRetosAdmin } from './paginas/admin/Fidelidad';
export { TarjetaEnvio, EsqueletoEnvio } from './piezas/admin/Pedidos';
export { PaginaRecepcion } from './paginas/admin/Pedidos';
export { PaginaPagos } from './paginas/admin/Pagos';
export { PaginaCuentasDePedidos } from './paginas/admin/Cuentas';
export { PaginaReclamos } from './paginas/admin/Reclamos';
export { GraficoTendencia } from './piezas/admin/Grafico';
export { EditorZonas, ListaZonas, DisenoPrenda, ColoresPrenda, PlantillasPrenda, variantesCrudas } from './piezas/admin/Crear';
export { EncuadreFoto, FotoEncuadrada, GaleriaFotos, CampoTallas, ElegirVarios, ElegirMarca } from './piezas/admin/Producto';
export {
  MENU_ADMIN, menuAdminPara, accesosAdminPara, puedeVer, esRutaActiva, opcionActiva,
  categoriaDesdeFirestore, categoriaAFirestore, marcaAdminDesdeFirestore, normalizarBusqueda, mismoNombre,
  coleccionDesdeFirestore, coleccionAFirestore, ATRIBUTOS, usosDeAtributo, atributoDesdeFirestore, atributoAFirestore,
  zonaDesdeFirestore, zonaAFirestore, clipartDesdeFirestore, clipartAFirestore,
  slugDeMarca, topeMonedasDe, TOPE_MONEDAS_POR_DEFECTO, marcaDesdeFirestore, marcaAFirestore, productoAdminDesde,
  esDeLaTienda, piezasDeCombos, etiquetasDeProducto, rutaAdminDeProducto, estadoDeStock,
  CUMPLIMIENTOS, fichaDesdeProducto, fichaAProducto, erroresDeFicha,
  personalizableDesde, packDesdeFirestore, packAGuardar, erroresDePack, MODOS_TALLA_PACK, MIN_PIEZAS_PACK, MAX_PIEZAS_PACK,
  areaVacia, blueprintDesdeFirestore, blueprintAFirestore,
  ESTADOS_RECEPCION, FILTROS_RECEPCION, pedidoEnFiltro, textoDePedido, resumenRecepcion, direccionParaCopiar,
  PERIODOS_PAGOS, rangoDePeriodo, enlaceEnFiltro, resumenEnlaces, serieDiariaEnlaces, duracionCorta, enlaceNuevo,
  MENSAJE_PAGOS_POR_DEFECTO, configPagosDesde, configPagosAMensajes,
  reclamoDesdeFirestore, respuestaDeReclamo, diasHabilesEntre, plazoDeReclamo, textoDeReclamo, filasMigracion,
  porCienVisitas, cambioPorcentual, cambioEnPuntos, cifrasDelResumen, otrosCobrosDe, serieDeVisitas, PERIODOS_RESULTADOS,
  listasDeProductos, listasDeVisitantes, enDiasTexto, quienDelCarrito, cumpleanosDe, resumenDeFicha, listasDeFicha,
  MAX_DIAS_RECONSTRUIR, ultimosDias, diasEntreClaves, tramosDeDias, ayudaDeRango, filasDeCalidad,
  segunOrigen, traficoPorDia, seguimientoDePedidos, listasDePaginas, claveAnonimaCorta, listasDeUso, nombreDePais, listasDeNavegador,
  ESTADOS_REFERIDO, referidoDesdeFirestore, resumenReferidos, misionDesdeFirestore, misionAFirestore,
  RECOMPENSAS_RETO, recompensaDeReto, retoDesdeFirestore, retoAFirestore, retoActivoDesde, evidenciaDesde,
} from './adaptadoresAdmin';
