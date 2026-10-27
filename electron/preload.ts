import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('grupoFesta', {
  versao: '1.0.0',
  plataforma: process.platform,
});
