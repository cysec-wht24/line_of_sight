import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { MainViewComponent } from './main-view/main-view.component';
import { DemDisplayComponent } from './main-view/dem-display/dem-display.component';
import { TimelineComponent } from './main-view/timeline/timeline.component';

@NgModule({
  declarations: [
    AppComponent,
    SidebarComponent,
    MainViewComponent,
    DemDisplayComponent,
    TimelineComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
