import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { DATA_ADAPTER } from './common/services/business-data.service';
import { JsonFileAdapter } from './common/services/json-file.adapter';
import { authInterceptor } from './common/services/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideClientHydration(),
    provideAnimations(),
    provideToastr({
      timeOut: 4000,
      positionClass: 'toast-top-right',
      closeButton: true,
      progressBar: true,
      newestOnTop: true,
      preventDuplicates: true,
      maxOpened: 4,
      autoDismiss: true
    }),
    { provide: DATA_ADAPTER, useClass: JsonFileAdapter }
  ]
};
