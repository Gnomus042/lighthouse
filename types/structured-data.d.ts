/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */


declare global {
  module LH {
    module StructuredData {
      export interface Failure {
        property?: string;
        message?: string;
        shape?: string;
        node: string;
        severity: string;
        severityLabel?: string;
        service?: string;

        /** additional properties could be added for annotations */
        [propName: string]: any;
      }

      export interface Report {
        baseUrl: string;
        store?: import('n3').Store;
        failures: Array<Failure>;
      }

      export interface Hierarchy {
        service: string,
        nested?: Array<Hierarchy>;
      }

      module RDF {
        export interface NamedNode {
          termType: 'NamedNode';
          id: string;
          value: string;
        }

        export interface BlankNode {
          termType: 'BlankNode';
          id: string;
          value: string;
        }

        export interface Literal {
          termType: 'Literal';
          value: string;
          language: string;
          datatype: NamedNode;
        }

        export type Term = NamedNode | BlankNode | Literal;

        export type Quad = {
          subject: NamedNode | BlankNode;
          predicate: NamedNode;
          object: NamedNode | BlankNode | Literal;
        }
      }

      export module ShEx {
        export module ShExJS {
          export module Parser {
            export type N3db = any;
            function construct(param1: string, param2: object, param3: object): {
              parse(shapes: string): ShEx.Schema;
            };
          }
          export module Util {
            function makeN3DB(data: string|import('n3').Store): Parser.N3db;
          }
          export module Validator {
            function construct(shapes: ShEx.Schema): {
              validate(db: Parser.N3db, params: Array<{shape: string, node: string}>): ShEx.Report;
            };
          }
        }

        export interface ReportItem {
          type: string;
          property?: string;
          node?: string;
          shape?: string;
          unexpectedTriples?: Array<{ predicate?: string }>;
          triple?: { subject?: string };
          ctx?: { predicate?: string };
          code?: string;
          constraint?: { predicate?: string };
          errors: Array<ReportItem>;
        }

        export type Report = ReportItem | Array<ReportItem>;

        export interface TripleConstraint {
          type: 'TripleConstraint';
          predicate: string;
          annotations?: Array<{
            predicate: string;
            object: { value: string };
          }>;
        }

        export interface TargetShape {
          type: 'Shape';
          id: string;
          expression: {
            type: string;
            expressions: Array<TripleConstraint>;
          };
        }

        export interface IntermediateShape {
          type: 'ShapeAnd' | 'ShapeOr';
          shapeExprs: Array<Shape>;
          id: string;
        }

        export type Shape = TargetShape | IntermediateShape;

        export interface Schema {
          type: string;
          shapes: Array<Shape>;
        }
      }

      export type LocalizedAnnotation = {
        '@shape': string,
        '@property': string,
        [propName: string]: string,
      }

      export type LocalizedAnnotations = {
        [uuid: string]: LocalizedAnnotation,
      }

      export type LocalizedMessages = {
        severity: {
          [severityLabel: string]: string,
        },
        failureTypes: {
          [typeLabel: string]: string,
        }
      }

      export type LocalizationFormatting = {
        [labelToBeReplaces: string]: string
      }
    }
  }
}

// empty export to keep file a module
export {};
