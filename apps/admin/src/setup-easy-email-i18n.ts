import { I18nManager } from 'easy-email-core';
import { ptBR } from './locales/easy-email-pt-br';

// Isso precisa ser executado ANTES de qualquer import do easy-email-extensions
I18nManager.setLocaleData(ptBR);
