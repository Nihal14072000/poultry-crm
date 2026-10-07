import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { DATA_ADAPTER } from './common/services/business-data.service';
import { JsonFileAdapter } from './common/services/json-file.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideClientHydration(),
    { provide: DATA_ADAPTER, useClass: JsonFileAdapter }
  ]
};
