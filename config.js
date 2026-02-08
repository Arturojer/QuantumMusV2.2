/**
 * Configuración del servidor para Quantum Mus
 * Detecta automáticamente la URL del backend para funcionar en local y en producción
 */
(function(global) {
  'use strict';

  function getServerUrl() {
    // Si hay una variable global configurada (útil para override en producción)
    if (global.QUANTUM_MUS_SERVER_URL) {
      return global.QUANTUM_MUS_SERVER_URL;
    }
    // Cuando el frontend se sirve desde el mismo servidor que el backend,
    // usar el origen actual (funciona en localhost y en producción)
    const origin = window.location.origin;
    return origin;
  }

  function isOnlineModeAvailable() {
    // En modo file:// no hay servidor
    return window.location.protocol !== 'file:';
  }

  global.QuantumMusConfig = {
    getServerUrl: getServerUrl,
    isOnlineModeAvailable: isOnlineModeAvailable
  };
})(typeof window !== 'undefined' ? window : this);
