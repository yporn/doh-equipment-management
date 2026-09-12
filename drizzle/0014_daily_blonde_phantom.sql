ALTER TABLE `machineries` ADD `acquisition_date` text;--> statement-breakpoint
ALTER TABLE `machineries` ADD `standard_life_years` integer;
--> statement-breakpoint
-- Source: อัตราค่าเช่า.xlsx, เครื่องจักร ศ.สท.ขก., C6:D206. Dates converted from Buddhist years.
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-10-02'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '00-0069-76-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-06-20'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '01-0225-95-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-06-20'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '01-0226-95-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-08-05'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '01-6024-02-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2015-10-28'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '15-6479-15-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-08-11'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '16-6005-95-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1996-12-20'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '16-6011-96-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1996-12-20'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '16-6013-96-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2019-01-21'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '20-6311-19-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2015-08-04'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '21-6513-15-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2017-02-09'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '21-6653-17-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2025-02-27'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '21-6723-25-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-08-07'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6158-97-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-08-07'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6159-97-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-08-07'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6178-97-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-08-07'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6198-97-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-06-28'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6237-04-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-06-28'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6239-04-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-06-28'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6240-04-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-06-28'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6241-04-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-06-28'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6242-04-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-06-28'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6243-04-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-06-28'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6244-04-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2008-08-25'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6262-08-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2016-08-01'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6307-16-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2016-08-01'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6308-16-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2018-07-11'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6353-18-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2018-07-11'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6354-18-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-06-28'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6410-20-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-06-28'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6411-20-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-07-26'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6488-22-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-07-26'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6489-22-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-07-26'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6490-22-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2024-07-12'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6581-24-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2025-09-17'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6595-25-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2026-06-24'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '23-6612-26-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-10-01'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-0743-95-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-10-01'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-0753-97-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1992-01-17'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6377-92-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-12-25'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6506-95-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-06-10'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6558-97-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-06-10'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6609-97-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-06-10'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6610-97-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-06-10'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6611-97-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-06-10'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6612-97-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2001-04-26'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6673-01-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-03-18'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6685-02-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-03-18'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6686-02-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-03-18'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6725-02-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-03-18'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6726-02-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-03-18'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6727-02-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-03-18'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6728-02-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-09-10'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6753-04-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-09-10'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '25-6763-04-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1980-03-21'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '26-0032-79-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-01-11'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '26-6003-95-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-01-11'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '26-6005-95-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-01-11'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '26-6007-95-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-01-11'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '26-6011-95-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1963-10-02'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '27-0080-63-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1988-08-09'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '27-6009-88-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1988-08-09'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '27-6011-88-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1988-08-09'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '27-6012-88-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1989-04-03'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '27-6015-89-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1992-11-05'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '27-6023-92-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-04-01'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '27-6144-22-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1986-01-28'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-0504-85-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-05-19'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-0543-95-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-05-19'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-0556-96-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1995-06-20'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6219-95-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-05-02'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6266-97-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-05-02'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6274-97-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-05-02'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6286-97-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-05-02'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6287-97-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2015-07-28'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6515-15-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2015-07-28'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6517-15-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2017-03-17'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6528-17-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2020-05-29'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6568-20-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2021-10-27'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6592-21-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2021-11-03'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6610-21-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-09-02'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6615-22-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2025-05-20'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6672-25-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2026-05-28'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '31-6700-26-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-05-29'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '35-0479-97-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1994-09-29'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '35-6036-94-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-11-05'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '35-6076-97-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-11-05'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '35-6077-97-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-11-05'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '35-6078-97-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1999-10-11'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '35-6098-99-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2019-04-18'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '35-6114-19-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2019-04-18'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '35-6115-19-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2019-04-18'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '35-6116-19-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2019-04-18'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '35-6117-19-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2026-05-11'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '35-6126-26-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2026-07-01'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '39-0003-26-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2026-07-01'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '39-0004-26-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1979-07-17'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-5081-79-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1979-07-17'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-5086-79-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2008-06-18'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-6070-08-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2008-06-18'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-6072-08-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2010-01-28'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-6077-10-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2010-01-28'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-6079-10-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2010-01-28'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-6080-10-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2015-09-23'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-6089-15-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2015-09-23'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-6090-15-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2017-06-30'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-6098-17-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2017-06-30'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-6099-17-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2025-06-24'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '41-6106-25-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2017-03-31'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-0029-17-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2017-03-31'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-0030-17-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2017-03-31'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-0031-17-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2018-05-17'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-0687-18-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2018-05-17'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-0688-18-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2018-05-17'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-0689-18-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2018-05-17'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-0690-18-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2018-05-17'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-0691-18-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2018-05-17'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-0692-18-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2018-05-17'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-0693-18-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2018-05-17'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-0694-18-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2020-03-19'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1029-20-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-07-22'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1605-22-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-07-22'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1606-22-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-07-22'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1607-22-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-07-22'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1608-22-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-07-22'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1609-22-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-07-22'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1610-22-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2023-02-02'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1663-23-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2023-07-03'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1725-23-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2024-06-21'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1804-24-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2024-06-21'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1805-24-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2024-07-09'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1855-24-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2024-07-09'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1856-24-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2013-03-25'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-1953-26-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2010-04-29'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-8944-10-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2010-12-29'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-8957-11-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2010-12-29'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-8960-11-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2010-12-29'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-8961-11-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2010-12-29'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-8962-11-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2013-03-25'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9099-13-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2013-03-25'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9100-13-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2013-03-25'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9130-13-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2013-03-25'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9132-13-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2013-03-25'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9133-13-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2013-03-25'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9138-13-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2014-08-27'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9584-14-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2015-09-16'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9643-15-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2016-06-03'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9720-16-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2016-06-03'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9721-16-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2016-06-03'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9722-16-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2016-06-03'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9723-16-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2016-06-22'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9849-16-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2016-06-22'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9851-16-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2016-06-22'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9852-16-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2017-02-24'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9967-17-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2017-02-24'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9968-17-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2017-02-24'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '44-9969-17-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2004-08-05'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '46-6309-04-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2007-11-28'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '46-6563-07-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1990-12-13'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '47-6067-90-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-11-05'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '47-6101-02-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-11-05'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '47-6102-02-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2016-01-14'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '61-6034-16-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2019-07-03'), standard_life_years = COALESCE(standard_life_years, 12) WHERE code = '63-6010-19-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-07-14'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '64-6019-97-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-04-25'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '64-6024-02-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1991-06-04'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '74-0111-91-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1991-07-05'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '74-6002-91-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-11-25'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '74-6061-02-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2005-04-11'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '74-6078-05-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2005-04-11'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '74-6086-05-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2009-03-20'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '74-6143-09-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2011-02-16'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '77-6136-11-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2014-02-20'), standard_life_years = COALESCE(standard_life_years, 8) WHERE code = '77-6193-14-6';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1990-12-18'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '78-6014-90-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1994-06-30'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6021-94-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1994-06-30'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6023-94-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1994-06-30'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6029-94-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-03-21'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6037-97-8';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '1997-03-21'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6048-97-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2001-05-04'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6057-01-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2001-05-04'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6058-01-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2001-05-04'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6060-01-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2002-07-08'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6074-02-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2008-12-06'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6079-08-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2008-12-06'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6080-08-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2008-12-06'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6081-08-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2008-12-06'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6090-08-4';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2010-02-16'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6095-10-1';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2010-02-16'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6096-10-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2014-03-24'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6115-14-9';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2016-10-25'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6153-16-3';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2018-05-23'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6169-18-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2019-03-19'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6204-19-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2019-03-26'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6209-19-7';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2020-07-21'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6230-20-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2021-12-29'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6233-21-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2022-03-16'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6239-22-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2023-12-22'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6296-23-2';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2025-07-07'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6316-25-0';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2026-06-18'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '82-6340-26-5';
--> statement-breakpoint
UPDATE machineries SET acquisition_date = COALESCE(acquisition_date, '2025-03-10'), standard_life_years = COALESCE(standard_life_years, 10) WHERE code = '87-0034-25-9';
