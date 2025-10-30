import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PhotoGraphsComponent } from './photo-graphs.component';

describe('PhotoGraphsComponent', () => {
  let component: PhotoGraphsComponent;
  let fixture: ComponentFixture<PhotoGraphsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotoGraphsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PhotoGraphsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
