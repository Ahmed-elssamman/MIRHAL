import { Injectable } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { from, Observable } from 'rxjs';

@Injectable()
export class MirhalTranslationLoader extends TranslateLoader {
  override getTranslation(language: string): Observable<TranslationObject> {
    switch (language) {
      case 'ar':
        return from(
          import('./assets/i18n/ar.json').then(({ default: translations }) => translations),
        );
      case 'en':
        return from(
          import('./assets/i18n/en.json').then(({ default: translations }) => translations),
        );
      default:
        return from(Promise.reject(new Error(`Unsupported translation language: ${language}`)));
    }
  }
}
