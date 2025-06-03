import { Component } from '@angular/core';

interface Position {
  x: number,
  y: number,
  elevation: number,
}

interface ObjectProperty {
  id: string,
  position: Position,
  height?: number,
  speed?: number,
  path: Position[]
}


@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})

export class SidebarComponent {

  // So i will have to create a private status for 5 functionality that would define 
  // either the functionality is complete or not which would be defined by the done 
  // button below of that functionality then a redo button would turn it back to false 

  private isComplete: boolean[] = [false, false, false, false, false];
  private isActive: boolean[] = [false, false, false, false, false];

  
  private ActivateOption(option: boolean) {
    // When an option inputted this would read and will activate functionality of the button
    console.log('Option activated:', option);
  }

  
  public SelectInitialPosition(): void{
    console.log('Initial position selected');
    this.isActive[0] = true;
    console.log('Select initial points');
  }

  public DefinePath(): void {}

  public DefineHeight(): void {}

  public DefineSpeed(): void {}

  public ConfirmDetails(): void {}

}
