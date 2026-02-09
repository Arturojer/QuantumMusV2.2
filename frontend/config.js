/**
 * Configuración centralizada del servidor - Quantum Mus
 *
 * Orden de prioridad para la URL del backend:
 * 1. window.QUANTUM_MUS_SERVER_URL (override manual o inyectado en producción)
 * 2. config.override.js (archivo opcional que define QUANTUM_MUS_SERVER_URL)
 * 3. window.location.origin (mismo dominio que la página; funciona en local y producción)
 *
 * Para producción en otro dominio: edita config.override.js o define
 * QUANTUM_MUS_SERVER_URL antes de cargar este script.
 */
(function(global) {
  'use strict';

  function getServerUrl() {
    if (global.QUANTUM_MUS_SERVER_URL && String(global.QUANTUM_MUS_SERVER_URL).trim() !== '') {
      return String(global.QUANTUM_MUS_SERVER_URL).replace(/\/$/, ''); // sin barra final
    }
    var origin = (global.location && global.location.origin) ? global.location.origin : '';
    return origin || '';
  }

  function isOnlineModeAvailable() {
    if (!global.location || !global.location.protocol) return false;
    return global.location.protocol !== 'file:';
  }

  global.QuantumMusConfig = {
    getServerUrl: getServerUrl,
    isOnlineModeAvailable: isOnlineModeAvailable
  };
})(typeof window !== 'undefined' ? window : this);
