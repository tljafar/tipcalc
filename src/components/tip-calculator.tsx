
"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DollarSign,
  Percent,
  Users,
  Minus,
  Plus,
  Coins,
  Wallet,
  ReceiptText,
  RotateCcw,
  TrendingUp,
  Share2,
  FileDown,
  Type,
  Store,
  MapPin,
  History,
  Trash2,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';

const tipCalculatorSchema = z.object({
  billAmount: z.coerce
    .number({ invalid_type_error: "Please enter a valid number." })
    .min(0.01, "Bill amount must be greater than $0.")
    .max(1000000, "Bill amount seems too high.")
    .optional()
    .or(z.literal(undefined)),
  taxAmount: z.coerce
    .number({ invalid_type_error: "Please enter a valid number for tax." })
    .min(0, "Tax amount must be $0 or more.")
    .max(50000, "Tax amount cannot exceed $50,000.")
    .optional()
    .or(z.literal(undefined)),
  tipPercentage: z.coerce
    .number({ invalid_type_error: "Please enter a valid number for tip %." })
    .min(0, "Tip percentage must be 0% or more.")
    .max(100, "Tip percentage cannot exceed 100%."),
  numberOfPeople: z.coerce
    .number({ invalid_type_error: "Please enter a valid number for people." })
    .int("Number of people must be a whole number.")
    .min(1, "At least one person must split the bill.")
    .max(100, "Cannot split with more than 100 people."),
  title: z.string().max(100, "Title cannot exceed 100 characters.").optional().or(z.literal(undefined)),
  restaurantName: z.string().max(100, "Restaurant name cannot exceed 100 characters.").optional().or(z.literal(undefined)),
  location: z.string().max(100, "Location cannot exceed 100 characters.").optional().or(z.literal(undefined)),
});

type TipCalculatorFormValues = z.infer<typeof tipCalculatorSchema>;

interface CalculationHistoryEntry extends TipCalculatorFormValues {
  id: string;
  savedAtDate: string;
  displayTotalPerPerson: number;
  displayTotalBill: number;
  roundUpPerPersonState: boolean;
}

interface AnimatedAmountProps {
  amount: number;
  currency?: string;
  className?: string;
}

const AnimatedAmount: React.FC<AnimatedAmountProps> = ({ amount, currency = "$", className }) => {
  const [displayAmount, setDisplayAmount] = React.useState(amount);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const prevAmountRef = React.useRef(amount);

  React.useEffect(() => {
    if (prevAmountRef.current !== amount && !isNaN(amount) && isFinite(amount)) {
      setIsAnimating(true);
      setDisplayAmount(amount);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      prevAmountRef.current = amount;
      return () => clearTimeout(timer);
    } else if (isNaN(amount) || !isFinite(amount) || amount === null || amount === undefined ) {
      setDisplayAmount(0);
      prevAmountRef.current = 0;
    } else if (prevAmountRef.current !== amount && (amount === null || amount === undefined)) {
       setDisplayAmount(0);
       prevAmountRef.current = 0;
    }
  }, [amount]);

  const formattedAmount = (isNaN(displayAmount) || !isFinite(displayAmount) || displayAmount === null || displayAmount === undefined) ? "0.00" : displayAmount.toFixed(2);

  return (
    <span
      className={cn(
        "transition-all duration-300 ease-out font-semibold",
        isAnimating ? "scale-110 text-accent-foreground bg-accent px-1 rounded" : "scale-100",
        className
      )}
    >
      {currency}{formattedAmount}
    </span>
  );
};


export default function TipCalculator() {
  const defaultFormValues: TipCalculatorFormValues = React.useMemo(() => ({ // Memoize default values
    billAmount: undefined,
    taxAmount: undefined,
    tipPercentage: 15,
    numberOfPeople: 1,
    title: undefined,
    restaurantName: undefined,
    location: undefined,
  }), []);

  const form = useForm<TipCalculatorFormValues>({
    resolver: zodResolver(tipCalculatorSchema),
    defaultValues: defaultFormValues,
    mode: "onChange",
  });

  const [tipPerPerson, setTipPerPerson] = React.useState(0);
  const [totalPerPerson, setTotalPerPerson] = React.useState(0);
  const [totalBillWithTip, setTotalBillWithTip] = React.useState(0);
  const [totalTipAmount, setTotalTipAmount] = React.useState(0);
  const [roundUpPerPerson, setRoundUpPerPerson] = React.useState(false);
  const [calculationHistory, setCalculationHistory] = React.useState<CalculationHistoryEntry[]>([]);
  const [calculationPerformed, setCalculationPerformed] = React.useState(false);
  const [pendingCalculationData, setPendingCalculationData] = React.useState<TipCalculatorFormValues | null>(null);
  const [initialQueryLoadDone, setInitialQueryLoadDone] = React.useState(false);


  const searchParams = useSearchParams();
  const { toast } = useToast();
  const router = useRouter();

  const processCalculation = React.useCallback((data: TipCalculatorFormValues) => {
    const {
      billAmount: validBillInput,
      taxAmount: validTaxInput,
      tipPercentage: validTip,
      numberOfPeople: validPeople
    } = data;

    const validBill = validBillInput ?? 0;
    if (validBill <= 0) {
      setTipPerPerson(0);
      setTotalPerPerson(0);
      setTotalBillWithTip(validTaxInput ?? 0);
      setTotalTipAmount(0);
      setCalculationPerformed(true);
      return {
        calculatedTotalPerPerson: 0,
        calculatedTotalBill: validTaxInput ?? 0,
        calculatedTipAmount: 0,
        calculatedTipPerPerson: 0,
      };
    }
    const numericTax = validTaxInput ?? 0;

    const baseTipAmount = validBill * (validTip / 100);
    const baseBillSubtotal = validBill + numericTax;
    const baseTotalBillWithTip = baseBillSubtotal + baseTipAmount;
    let calculatedTotalPerPerson = baseTotalBillWithTip / validPeople;

    let finalTotalPerPerson = calculatedTotalPerPerson;
    if (roundUpPerPerson && validPeople > 0) { // Uses the component's roundUpPerPerson state
      finalTotalPerPerson = Math.ceil(calculatedTotalPerPerson);
    }

    const finalTotalBill = finalTotalPerPerson * validPeople;
    const finalTipAmount = finalTotalBill - baseBillSubtotal;
    const finalTipPerPerson = validPeople > 0 ? finalTipAmount / validPeople : 0;

    setTotalTipAmount(finalTipAmount > 0 ? finalTipAmount : 0);
    setTotalBillWithTip(finalTotalBill > 0 ? finalTotalBill : 0);
    setTipPerPerson(finalTipPerPerson > 0 ? finalTipPerPerson : 0);
    setTotalPerPerson(finalTotalPerPerson > 0 ? finalTotalPerPerson : 0);
    setCalculationPerformed(true);

    return {
        calculatedTotalPerPerson: finalTotalPerPerson > 0 ? finalTotalPerPerson : 0,
        calculatedTotalBill: finalTotalBill > 0 ? finalTotalBill : 0,
        calculatedTipAmount: finalTipAmount > 0 ? finalTipAmount : 0,
        calculatedTipPerPerson: finalTipPerPerson > 0 ? finalTipPerPerson : 0,
    };
  }, [roundUpPerPerson]);


  const addCalculationToHistory = React.useCallback((
    currentValues: TipCalculatorFormValues,
    calculatedTotalPerPerson: number,
    calculatedTotalBill: number
  ) => {
    if (calculatedTotalPerPerson > 0) {
      const newHistoryEntry: CalculationHistoryEntry = {
        ...currentValues,
        id: Date.now().toString(),
        savedAtDate: new Date().toLocaleDateString(),
        displayTotalPerPerson: calculatedTotalPerPerson,
        displayTotalBill: calculatedTotalBill,
        roundUpPerPersonState: roundUpPerPerson, // Save current state of the switch
      };

      setCalculationHistory(prevHistory => {
        const updatedHistory = [newHistoryEntry, ...prevHistory].slice(0, 5);
        return updatedHistory;
      });
    }
  }, [roundUpPerPerson]);


  const onSubmit: SubmitHandler<TipCalculatorFormValues> = (data) => {
    const results = processCalculation(data);
    if (data.billAmount && data.billAmount > 0) {
        addCalculationToHistory(data, results.calculatedTotalPerPerson, results.calculatedTotalBill);
    }
  };

  React.useEffect(() => {
    const storedHistory = localStorage.getItem('tipSplitHistory');
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory) as CalculationHistoryEntry[];
        if (Array.isArray(parsedHistory) && parsedHistory.every(item => item.id && item.savedAtDate)) {
          setCalculationHistory(parsedHistory);
        } else {
          localStorage.removeItem('tipSplitHistory');
        }
      } catch (error) {
        console.error("Failed to parse history from localStorage", error);
        localStorage.removeItem('tipSplitHistory');
      }
    }
  }, []);

  React.useEffect(() => {
    if (calculationHistory.length > 0 || localStorage.getItem('tipSplitHistory')) {
        localStorage.setItem('tipSplitHistory', JSON.stringify(calculationHistory));
    }
  }, [calculationHistory]);

  // Effect for loading from query parameters
  React.useEffect(() => {
    if (initialQueryLoadDone || typeof window === 'undefined') return;

    const query = new URLSearchParams(window.location.search);
    const billFromQuery = query.get("bill");
    const taxFromQuery = query.get("tax");
    const tipFromQuery = query.get("tip");
    const peopleFromQuery = query.get("people");
    const roundUpFromQuery = query.get("roundUp");
    const titleFromQuery = query.get("title");
    const restaurantFromQuery = query.get("restaurant");
    const locationFromQuery = query.get("location");

    let dataLoadedFromQuery = false;
    const loadedValues: TipCalculatorFormValues = { ...defaultFormValues };

    if (billFromQuery !== null) { loadedValues.billAmount = parseFloat(billFromQuery); dataLoadedFromQuery = true; }
    if (taxFromQuery !== null) { loadedValues.taxAmount = parseFloat(taxFromQuery); dataLoadedFromQuery = true; }
    if (tipFromQuery !== null) { loadedValues.tipPercentage = parseInt(tipFromQuery, 10); dataLoadedFromQuery = true; }
    if (peopleFromQuery !== null) { loadedValues.numberOfPeople = parseInt(peopleFromQuery, 10); dataLoadedFromQuery = true; }
    if (titleFromQuery !== null) { loadedValues.title = titleFromQuery; dataLoadedFromQuery = true; }
    if (restaurantFromQuery !== null) { loadedValues.restaurantName = restaurantFromQuery; dataLoadedFromQuery = true; }
    if (locationFromQuery !== null) { loadedValues.location = locationFromQuery; dataLoadedFromQuery = true; }
    
    if (dataLoadedFromQuery) {
      form.reset(loadedValues); // Reset form first
      if (roundUpFromQuery === 'true' || roundUpFromQuery === 'false') {
        setRoundUpPerPerson(roundUpFromQuery === 'true');
      }
      setPendingCalculationData(loadedValues);
      setInitialQueryLoadDone(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, form, defaultFormValues, setRoundUpPerPerson, initialQueryLoadDone]);


  // Effect to process pending calculation (from history or query params)
  React.useEffect(() => {
    if (pendingCalculationData) {
      const parsedData = tipCalculatorSchema.safeParse(pendingCalculationData);
      if (parsedData.success) {
        processCalculation(parsedData.data);
      } else {
        console.error("Error parsing loaded data in useEffect:", parsedData.error);
        // Optionally, reset or show error to user
        form.reset(defaultFormValues); // Reset to defaults if loaded data is bad
        setRoundUpPerPerson(false);
        setCalculationPerformed(false);
      }
      setPendingCalculationData(null); // Reset after processing
    }
  }, [pendingCalculationData, processCalculation, form, defaultFormValues]);


  const tipOptions = [10, 15, 18, 20, 25];
  const peopleOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const handlePeopleChange = (increment: boolean) => {
    const currentValue = form.getValues("numberOfPeople") || 1;
    const newValue = increment ? currentValue + 1 : Math.max(1, currentValue - 1);
    if (newValue <= 100 && newValue >= 1) {
       form.setValue("numberOfPeople", newValue, { shouldValidate: true });
    }
  };

  const handleReset = () => {
    form.reset(defaultFormValues);
    setRoundUpPerPerson(false);
    setTipPerPerson(0);
    setTotalPerPerson(0);
    setTotalBillWithTip(0);
    setTotalTipAmount(0);
    setCalculationPerformed(false);
    router.push(window.location.pathname, { scroll: false });
  };

  const handleShare = async () => {
    form.trigger(); // Explicitly trigger validation
    if (!form.formState.isValid || !calculationPerformed || totalPerPerson <= 0) {
        toast({ title: "Cannot Share", description: "Please perform a valid calculation first or correct errors.", variant: "destructive" });
        return;
    }
    const values = form.getValues();
    const params = new URLSearchParams();

    if (typeof values.billAmount === 'number' && !isNaN(values.billAmount)) params.append('bill', String(values.billAmount));
    if (typeof values.taxAmount === 'number' && !isNaN(values.taxAmount)) params.append('tax', String(values.taxAmount));
    if (typeof values.tipPercentage === 'number' && !isNaN(values.tipPercentage)) params.append('tip', String(values.tipPercentage));
    if (typeof values.numberOfPeople === 'number' && !isNaN(values.numberOfPeople)) params.append('people', String(values.numberOfPeople));
    if (values.title) params.append('title', values.title);
    if (values.restaurantName) params.append('restaurant', values.restaurantName);
    if (values.location) params.append('location', values.location);
    params.append('roundUp', String(roundUpPerPerson));

    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link Copied!", description: "Calculation link copied to clipboard." });
    } catch (err) {
      console.error("Failed to copy: ", err);
      toast({ title: "Error", description: "Could not copy link to clipboard.", variant: "destructive" });
    }
  };

  const handleDownloadPDF = () => {
    form.trigger(); // Explicitly trigger validation
    if (!form.formState.isValid || !calculationPerformed || totalPerPerson <= 0 ) {
        toast({ title: "Cannot Download PDF", description: "Please perform a valid calculation first or correct errors.", variant: "destructive" });
        return;
    }
    const values = form.getValues();
    const bill = values.billAmount ?? 0;
    const tax = values.taxAmount ?? 0;
    const tipPercent = values.tipPercentage ?? 0;
    const people = values.numberOfPeople ?? 1;
    const pdfTitle = values.title || "TipSplit Summary";
    const pdfRestaurant = values.restaurantName;
    const pdfLocation = values.location;

    const doc = new jsPDF();
    let yPosition = 20;
    const lineHeight = 10;
    const sectionSpacing = 5;

    doc.setFontSize(18); doc.text(pdfTitle, 20, yPosition); yPosition += lineHeight;
    if (pdfRestaurant) { doc.setFontSize(12); doc.text(`Restaurant: ${pdfRestaurant}`, 20, yPosition); yPosition += lineHeight; }
    if (pdfLocation) { doc.setFontSize(12); doc.text(`Location: ${pdfLocation}`, 20, yPosition); yPosition += lineHeight; }
    if (pdfRestaurant || pdfLocation) yPosition += sectionSpacing;

    doc.setFontSize(12);
    doc.text(`Bill Amount: $${bill.toFixed(2)}`, 20, yPosition); yPosition += lineHeight;
    if (tax > 0) { doc.text(`Tax Amount: $${tax.toFixed(2)}`, 20, yPosition); yPosition += lineHeight; }
    doc.text(`Tip Percentage: ${tipPercent}%`, 20, yPosition); yPosition += lineHeight;
    doc.text(`Number of People: ${people}`, 20, yPosition); yPosition += lineHeight;
    doc.text(`Round Up Per Person: ${roundUpPerPerson ? 'Yes' : 'No'}`, 20, yPosition); yPosition += lineHeight + sectionSpacing;
    doc.text("--------------------------", 20, yPosition); yPosition += lineHeight;
    doc.setFontSize(14); doc.text("Results:", 20, yPosition); yPosition += lineHeight + sectionSpacing;
    doc.setFontSize(12);
    doc.text(`Total Tip: $${totalTipAmount.toFixed(2)}`, 20, yPosition); yPosition += lineHeight;
    doc.text(`Total Bill (incl. Tax & Tip): $${totalBillWithTip.toFixed(2)}`, 20, yPosition); yPosition += lineHeight;
    doc.text(`Tip Per Person: $${tipPerPerson.toFixed(2)}`, 20, yPosition); yPosition += lineHeight;
    doc.text(`Total Per Person: $${totalPerPerson.toFixed(2)}`, 20, yPosition); yPosition += lineHeight * 2;

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("Generated by TipSplit App", 20, yPosition);

    doc.save("tipsplit-summary.pdf");
    toast({ title: "PDF Downloaded", description: "Your TipSplit summary has been downloaded." });
  };

  const loadCalculationFromHistory = (entry: CalculationHistoryEntry) => {
    const valuesToLoad: TipCalculatorFormValues = {
      billAmount: entry.billAmount,
      taxAmount: entry.taxAmount,
      tipPercentage: entry.tipPercentage,
      numberOfPeople: entry.numberOfPeople,
      title: entry.title,
      restaurantName: entry.restaurantName,
      location: entry.location,
    };
    form.reset(valuesToLoad); // Reset form fields
    setRoundUpPerPerson(entry.roundUpPerPersonState); // Set the switch state
    setPendingCalculationData(valuesToLoad); // Trigger calculation via useEffect

    toast({ title: "Calculation Loaded", description: entry.title || entry.restaurantName || `Calculation on ${entry.savedAtDate}` });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearHistory = () => {
    setCalculationHistory([]);
    localStorage.removeItem('tipSplitHistory');
    toast({ title: "History Cleared", description: "All saved calculations have been removed."});
  }

  const isSecondaryActionDisabled = !calculationPerformed || totalPerPerson <= 0 || !form.formState.isValid;

  return (
    <>
      <Card className="w-full max-w-lg shadow-2xl bg-card mb-8">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">TipSplit</CardTitle>
          <CardDescription className="text-muted-foreground">
            Calculate tip, tax, and split the bill with ease. Share or download your calculation!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center text-card-foreground/90">
                <Type className="mr-2 h-5 w-5 text-primary" /> Title/Event (Optional)
              </Label>
              <Controller
                name="title"
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="title"
                    type="text"
                    placeholder="e.g., Birthday Dinner"
                    className="text-lg"
                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
                    value={field.value === undefined ? "" : String(field.value)}
                  />
                )}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* Restaurant Name */}
            <div className="space-y-2">
              <Label htmlFor="restaurantName" className="flex items-center text-card-foreground/90">
                <Store className="mr-2 h-5 w-5 text-primary" /> Restaurant Name (Optional)
              </Label>
              <Controller
                name="restaurantName"
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="restaurantName"
                    type="text"
                    placeholder="e.g., The Grand Eatery"
                    className="text-lg"
                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
                    value={field.value === undefined ? "" : String(field.value)}
                  />
                )}
              />
              {form.formState.errors.restaurantName && (
                <p className="text-sm text-destructive">{form.formState.errors.restaurantName.message}</p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center text-card-foreground/90">
                <MapPin className="mr-2 h-5 w-5 text-primary" /> Location (Optional)
              </Label>
              <Controller
                name="location"
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="location"
                    type="text"
                    placeholder="e.g., Downtown City"
                    className="text-lg"
                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
                    value={field.value === undefined ? "" : String(field.value)}
                  />
                )}
              />
              {form.formState.errors.location && (
                <p className="text-sm text-destructive">{form.formState.errors.location.message}</p>
              )}
            </div>

            {/* Bill Amount */}
            <div className="space-y-2">
              <Label htmlFor="billAmount" className="flex items-center text-card-foreground/90">
                <DollarSign className="mr-2 h-5 w-5 text-primary" /> Bill Amount
              </Label>
              <Controller
                name="billAmount"
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="billAmount"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 50.00"
                    className="text-lg"
                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                    value={field.value === undefined ? "" : String(field.value)}
                  />
                )}
              />
              {form.formState.errors.billAmount && (
                <p className="text-sm text-destructive">{form.formState.errors.billAmount.message}</p>
              )}
            </div>

            {/* Tax Amount */}
            <div className="space-y-2">
              <Label htmlFor="taxAmount" className="flex items-center text-card-foreground/90">
                <ReceiptText className="mr-2 h-5 w-5 text-primary" /> Tax Amount (Optional)
              </Label>
              <Controller
                name="taxAmount"
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="taxAmount"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 5.00"
                    className="text-lg"
                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                    value={field.value === undefined ? "" : String(field.value)}
                  />
                )}
              />
              {form.formState.errors.taxAmount && (
                <p className="text-sm text-destructive">{form.formState.errors.taxAmount.message}</p>
              )}
            </div>

            {/* Tip Percentage */}
            <div className="space-y-2">
              <Label htmlFor="tipPercentage" className="flex items-center text-card-foreground/90">
                <Percent className="mr-2 h-5 w-5 text-primary" /> Tip Percentage
              </Label>
              <Controller
                name="tipPercentage"
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="tipPercentage"
                    type="number"
                    placeholder="e.g., 15"
                    className="text-lg"
                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                    value={field.value === undefined ? "" : String(field.value)}
                  />
                )}
              />
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                {tipOptions.map((tip) => (
                  <Button
                    key={tip}
                    type="button"
                    variant={form.watch("tipPercentage") === tip ? "default" : "outline"}
                    onClick={() => form.setValue("tipPercentage", tip, { shouldValidate: true })}
                    className="w-full"
                  >
                    {tip}%
                  </Button>
                ))}
              </div>
              {form.formState.errors.tipPercentage && (
                <p className="text-sm text-destructive">{form.formState.errors.tipPercentage.message}</p>
              )}
            </div>

            {/* Number of People */}
            <div className="space-y-2">
              <Label htmlFor="numberOfPeople" className="flex items-center text-card-foreground/90">
                <Users className="mr-2 h-5 w-5 text-primary" /> Number of People
              </Label>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handlePeopleChange(false)}
                  aria-label="Decrease number of people"
                  disabled={(form.getValues("numberOfPeople") || 1) <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Controller
                  name="numberOfPeople"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="numberOfPeople"
                      type="number"
                      placeholder="e.g., 2"
                      className="text-lg text-center flex-grow"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          field.onChange(undefined);
                        } else {
                          const num = parseInt(val, 10);
                          if (num >=1 && num <= 100) {
                             field.onChange(num);
                          } else if (num < 1) {
                             field.onChange(1);
                          } else if (num > 100) {
                             field.onChange(100);
                          } else {
                             field.onChange(num)
                          }
                        }
                      }}
                      value={field.value === undefined ? "" : String(field.value)}
                    />
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handlePeopleChange(true)}
                  aria-label="Increase number of people"
                  disabled={(form.getValues("numberOfPeople") || 1) >= 100}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                {peopleOptions.map((num) => (
                  <Button
                    key={num}
                    type="button"
                    variant={form.watch("numberOfPeople") === num ? "default" : "outline"}
                    onClick={() => form.setValue("numberOfPeople", num, { shouldValidate: true })}
                    className="w-full"
                  >
                    {num}
                  </Button>
                ))}
              </div>
              {form.formState.errors.numberOfPeople && (
                <p className="text-sm text-destructive">{form.formState.errors.numberOfPeople.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <Switch
                id="roundUpPerPerson"
                checked={roundUpPerPerson}
                onCheckedChange={setRoundUpPerPerson}
                aria-label="Round total per person up to nearest dollar"
              />
              <Label htmlFor="roundUpPerPerson" className="flex items-center text-card-foreground/90 cursor-pointer">
                 <TrendingUp className="mr-2 h-5 w-5 text-primary" /> Round Total Per Person Up (Nearest Dollar)
              </Label>
            </div>

            {/* Reset and Calculate Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6">
              <Button type="button" variant="outline" className="w-full text-lg py-3" size="lg" onClick={handleReset}>
                <RotateCcw className="mr-2 h-5 w-5" /> Reset
              </Button>
              <Button type="submit" className="w-full text-lg py-3" size="lg" disabled={!form.formState.isValid && form.formState.isSubmitted}>
                <Calculator className="mr-2 h-5 w-5" /> Calculate
              </Button>
            </div>
          </form>
        </CardContent>

        <Separator className="my-2 mx-6 bg-border/50" />

        <CardFooter className="flex flex-col space-y-6 p-6 bg-secondary/10 rounded-b-lg">
          {calculationPerformed ? (
            <>
              <div className="w-full space-y-3">
                <div className="flex justify-between items-center p-3 bg-card/50 rounded-md shadow-sm">
                  <div className="text-sm text-muted-foreground">Total Tip</div>
                  <AnimatedAmount amount={totalTipAmount} className="text-xl text-primary" />
                </div>
                <div className="flex justify-between items-center p-3 bg-card/50 rounded-md shadow-sm">
                  <div className="text-sm text-muted-foreground">Total Bill (incl. Tax & Tip)</div>
                  <AnimatedAmount amount={totalBillWithTip} className="text-xl text-primary" />
                </div>
              </div>

              <Separator className="my-2 bg-border/50" />

              <div className="w-full space-y-4">
                <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg shadow">
                  <div className="flex items-center">
                    <Coins className="h-8 w-8 text-accent mr-3 shrink-0" />
                    <div>
                      <p className="font-medium text-accent">Tip Per Person</p>
                      <p className="text-xs text-accent/80 hidden sm:block">Each person's share of the tip</p>
                    </div>
                  </div>
                  <AnimatedAmount amount={tipPerPerson} className="text-2xl text-accent" />
                </div>

                <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg shadow">
                  <div className="flex items-center">
                    <Wallet className="h-8 w-8 text-primary mr-3 shrink-0" />
                    <div>
                      <p className="font-medium text-primary">Total Per Person</p>
                      <p className="text-xs text-primary/80 hidden sm:block">Including their share of tax & tip</p>
                    </div>
                  </div>
                  <AnimatedAmount amount={totalPerPerson} className="text-2xl text-primary" />
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>Enter bill details and click "Calculate" to see the results.</p>
            </div>
          )}
           {(!form.formState.isValid && form.formState.isSubmitted && Object.keys(form.formState.errors).length > 0) && (
            <p className="text-sm text-destructive text-center pt-2">Please correct the errors above to perform calculations.</p>
          )}
        </CardFooter>

        {/* Share and PDF Buttons - After Results */}
        <div className="px-6 pt-4 pb-6 border-t border-border/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button type="button" variant="secondary" className="w-full text-lg py-3" size="lg" onClick={handleShare} disabled={isSecondaryActionDisabled}>
                <Share2 className="mr-2 h-5 w-5" /> Share
              </Button>
              <Button type="button" variant="secondary" className="w-full text-lg py-3" size="lg" onClick={handleDownloadPDF} disabled={isSecondaryActionDisabled}>
                <FileDown className="mr-2 h-5 w-5" /> PDF
              </Button>
          </div>
        </div>
      </Card>

      {calculationHistory.length > 0 && (
        <Card className="w-full max-w-lg shadow-xl bg-card">
          <CardHeader>
            <div className="flex justify-between items-center">
                <div className="flex items-center">
                    <History className="mr-2 h-6 w-6 text-primary" />
                    <CardTitle className="text-xl font-semibold text-primary">Calculation History</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={clearHistory} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="mr-1 h-4 w-4" /> Clear All
                </Button>
            </div>
            <CardDescription className="text-muted-foreground">
              Your last {calculationHistory.length} calculation{calculationHistory.length === 1 ? '' : 's'}. Click to reload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {calculationHistory.map((entry) => (
              <Button
                key={entry.id}
                variant="outline"
                className="w-full justify-start h-auto py-3 px-4 text-left"
                onClick={() => loadCalculationFromHistory(entry)}
              >
                <div className="flex flex-col w-full">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-card-foreground truncate pr-2">
                      {entry.title || entry.restaurantName || `Calculation on ${entry.savedAtDate}`}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {entry.savedAtDate}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Bill: ${entry.billAmount?.toFixed(2) ?? '0.00'} |
                    Tax: ${entry.taxAmount?.toFixed(2) ?? '0.00'} |
                    Tip: {entry.tipPercentage}% |
                    People: {entry.numberOfPeople}
                  </div>
                  <div className="text-sm font-semibold text-primary mt-1">
                    Total/Person: ${entry.displayTotalPerPerson.toFixed(2)}
                  </div>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
