import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ItemResponse } from '../../shared/interface/item-info';
import { Product } from '../../shared/interface/product';
import { ProductInfoService } from '../../shared/services/product-info.service';
import DatalabelsPlugin from 'chartjs-plugin-datalabels';
import { ChartConfiguration, ChartData, ChartEvent, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ShoppingListService } from 'src/app/shared/services/shopping-list.service';
import * as AOS from 'aos';
import { MacroCalculatorService } from 'src/app/shared/services/macro-calculator.service';
import { UserStorageService } from 'src/app/shared/services/auth/user-storage.service';
import { PopUpComponent } from 'src/app/shared/pop-up/pop-up.component';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.css'],
})
export class ProductDetailsComponent implements OnInit {
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;
  numberOfGrams: number;
  showSpinner: boolean = false;
  barcode: string = '';
  selectedItem: Product;
  images: string[] = [];
  date: string;

  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      datalabels: {
        formatter: (value, ctx) => {
          // if (ctx.chart.data.labels) {
          //   return ctx.chart.data.labels[ctx.dataIndex];
          // }
        },
      },
    },
  };
  public pieChartData: ChartData<'pie', number[], string | string[]> = {
    labels: [['Carbs (g) '], ['Fats (g) '], ['Protein (g) ']],
    datasets: [
      {
        data: [3, 3, 3],
      },
    ],
  };
  public pieChartType: ChartType = 'pie';
  public pieChartPlugins = [DatalabelsPlugin];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private productInfoService: ProductInfoService,
    private shoppingListService: ShoppingListService,
    private macroService: MacroCalculatorService,
    private userStorageService: UserStorageService,
    private _snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    AOS.init();
    this.date = new Date().toLocaleDateString('en-us', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    this.date = this.date.replace('/', '-').replace('/', '-');
    this.userStorageService
      .fetchUserFromFireBase()
      .subscribe((userData: any) => {
        if (
          userData.foodLog !== undefined &&
          userData.foodLog[this.date] !== undefined
        ) {
          this.macroService.foodLog = userData.foodLog[this.date];
        } else this.macroService.foodLog = [];
      });
    if (!(this.route.snapshot.params['id'] === 'search')) {
      this.showSpinner = true;
      this.productInfoService
        .getItemInfo(this.route.snapshot.params['id'])
        .subscribe((infoItem: ItemResponse) => {
          this.barcode = this.route.snapshot.params['id'];
          this.selectedItem = infoItem.product;
          let dataSet = this.dataSet(infoItem);
          this.pieChartData.datasets = dataSet;
          this.images = [];
          if (infoItem.product.selected_images !== null || undefined) {
            this.images.push(
              infoItem.product.selected_images.front
                ? infoItem.product.selected_images.front.display.en
                : null,
              infoItem.product.selected_images.nutrition
                ? infoItem.product.selected_images.nutrition.display.en
                : null,
              infoItem.product.selected_images.ingredients
                ? infoItem.product.selected_images.ingredients.display.en
                : null
            );
          }
          this.images = this.images.filter((image) => image !== null);
          let dataTable = this.dataTable();
          this.dataSource = dataTable;
          this.showSpinner = false;
        });
    }
  }
  getProductsByBarcode() {
    this.showSpinner = true;
    this.productInfoService
      .getItemInfo(this.barcode.toString())
      .subscribe((infoItem: ItemResponse) => {
        this.router.navigate([`product/nutrients/${this.barcode}`]);
        this.selectedItem = infoItem.product;
        let dataSet = this.dataSet(infoItem);
        this.pieChartData.datasets = dataSet;
        this.images = [];

        if (infoItem.product.selected_images !== null || undefined) {
          this.images.push(
            infoItem.product.selected_images.front
              ? infoItem.product.selected_images.front.display.en
              : null,
            infoItem.product.selected_images.nutrition
              ? infoItem.product.selected_images.nutrition.display.en
              : null,
            infoItem.product.selected_images.ingredients
              ? infoItem.product.selected_images.ingredients.display.en
              : null
          );
        }
        let dataTable = this.dataTable();
        this.dataSource = dataTable;

        this.showSpinner = false;
      });
  }

  addToShoppingList() {
    this.shoppingListService.addToShoppingList(this.selectedItem);
  }
  logFood() {
    this.selectedItem['numberOfGrams'] = this.numberOfGrams;
    this.selectedItem['calories'] = Math.round(
      (this.selectedItem.nutriments.carbohydrates_100g / 100) *
        this.numberOfGrams *
        4 +
        (this.selectedItem.nutriments.proteins_100g / 100) *
          this.numberOfGrams *
          4 +
        (this.selectedItem.nutriments.fat_100g / 100) * this.numberOfGrams * 9
    );
    this.selectedItem['macros'] = {
      carbs: Math.round(
        (this.selectedItem.nutriments.carbohydrates_100g / 100) *
          this.numberOfGrams
      ),
      proteins: Math.round(
        (this.selectedItem.nutriments.proteins_100g / 100) * this.numberOfGrams
      ),
      fats: Math.round(
        (this.selectedItem.nutriments.fat_100g / 100) * this.numberOfGrams
      ),
    };
    if (this.macroService.foodLog === undefined) {
      this.macroService.foodLog = [];
    }
    this.macroService.foodLog.push(this.selectedItem);
    this.userStorageService.storeFoodLog().subscribe();
    this._snackBar.openFromComponent(PopUpComponent, {
      duration: 1500,
      data: {
        loggedItem: {
          item: this.selectedItem,
          numberOfGrams: this.numberOfGrams,
        },
      },
    });
  }

  dataSet(infoItem: ItemResponse) {
    return [
      {
        data: [
          infoItem.product.nutriments.carbohydrates_serving
            ? infoItem.product.nutriments.carbohydrates_serving
            : infoItem.product.nutriments.carbohydrates_value,
          infoItem.product.nutriments.fat_serving
            ? infoItem.product.nutriments.fat_serving
            : infoItem.product.nutriments.fat_value,
          infoItem.product.nutriments.proteins_serving
            ? infoItem.product.nutriments.proteins_serving
            : infoItem.product.nutriments.proteins_value,
        ],
        backgroundColor: [
          'rgb(77, 130, 120, 0.5)',
          'rgb(164, 208, 175, 0.5)',
          'rgb(56, 73, 81, 0.5)',
        ],
        borderColor: ['white'],
        pointBackgroundColor: ['#4d8278', '#A4D0AF', '#384951'],
        pointBorderColor: ['#fff'],
        pointHoverBackgroundColor: ['#fff'],
        pointHoverBorderColor: ['#4d8278', '#A4D0AF', '#384951'],
        hoverBackgroundColor: ['#4d8278', '#A4D0AF', '#384951'],
        hoverBorderColor: ['#4d8278', '#A4D0AF', '#384951'],
      },
    ];
  }
  dataTable() {
    return [
      {
        name: 'Carbohydrates',
        weight: this.selectedItem.nutriments.carbohydrates_serving
          ? this.selectedItem.nutriments.carbohydrates_serving.toFixed(2)
          : this.selectedItem.nutriments.carbohydrates_value
          ? this.selectedItem.nutriments.carbohydrates_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Grams',
      },
      {
        name: 'Fat',
        weight: this.selectedItem.nutriments.fat_serving
          ? this.selectedItem.nutriments.fat_serving.toFixed(2)
          : this.selectedItem.nutriments.fat_value
          ? this.selectedItem.nutriments.fat_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Grams',
      },
      {
        name: 'Proteins',
        weight: this.selectedItem.nutriments.proteins_serving
          ? this.selectedItem.nutriments.proteins_serving.toFixed(2)
          : this.selectedItem.nutriments.proteins_value
          ? this.selectedItem.nutriments.proteins_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Grams',
      },
      {
        name: 'Trans-Fat',
        weight: this.selectedItem.nutriments.trans_fat_serving
          ? this.selectedItem.nutriments.trans_fat_serving.toFixed(2)
          : this.selectedItem.nutriments.trans_fat_value
          ? this.selectedItem.nutriments.trans_fat_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Grams',
      },
      {
        name: 'Saturated-Fat',
        weight: this.selectedItem.nutriments.saturated_fat_serving
          ? this.selectedItem.nutriments.saturated_fat_serving.toFixed(2)
          : this.selectedItem.nutriments.saturated_fat_value
          ? this.selectedItem.nutriments.saturated_fat_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Grams',
      },
      {
        name: 'Sugars',
        weight: this.selectedItem.nutriments.sugars_serving
          ? this.selectedItem.nutriments.sugars_serving.toFixed(2)
          : this.selectedItem.nutriments.sugars_value
          ? this.selectedItem.nutriments.sugars_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Grams',
      },
      {
        name: 'Fiber',
        weight: this.selectedItem.nutriments.fiber_serving
          ? this.selectedItem.nutriments.fiber_serving.toFixed(2)
          : this.selectedItem.nutriments.fiber_value
          ? this.selectedItem.nutriments.fiber_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Grams',
      },
      {
        name: 'Calcium',
        weight: this.selectedItem.nutriments.calcium_serving
          ? this.selectedItem.nutriments.calcium_serving.toFixed(2)
          : this.selectedItem.nutriments.calcium_value
          ? this.selectedItem.nutriments.calcium_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Milligrams',
      },
      {
        name: 'Cholesterol',
        weight: this.selectedItem.nutriments.cholesterol_serving
          ? this.selectedItem.nutriments.cholesterol_serving.toFixed(2)
          : this.selectedItem.nutriments.cholesterol_value
          ? this.selectedItem.nutriments.cholesterol_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Milligrams',
      },
      {
        name: 'Salt',
        weight: this.selectedItem.nutriments.salt_serving
          ? this.selectedItem.nutriments.salt_serving.toFixed(2)
          : this.selectedItem.nutriments.salt_value
          ? this.selectedItem.nutriments.salt_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Milligrams',
      },
      {
        name: 'Sodium',
        weight: this.selectedItem.nutriments.sodium_serving
          ? this.selectedItem.nutriments.sodium_serving.toFixed(2)
          : this.selectedItem.nutriments.sodium_value
          ? this.selectedItem.nutriments.sodium_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Milligrams',
      },
      {
        name: 'Iron',
        weight: this.selectedItem.nutriments.iron_serving
          ? this.selectedItem.nutriments.iron_serving.toFixed(2)
          : this.selectedItem.nutriments.iron_value
          ? this.selectedItem.nutriments.iron_value.toFixed(2)
          : 'Unavailable',
        symbol: 'Milligrams',
      },
    ];
  }

  displayedColumns: string[] = ['name', 'weight', 'symbol'];
  dataSource: {}[];
}
