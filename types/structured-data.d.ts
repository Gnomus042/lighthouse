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
        node?: string;
        severity: string;
        service?: string;
        /** additional properties could be added for annotations */
        [propName: string]: any;
      }

      export interface Hierarchy {
        service: string,
        nested?: Array<Hierarchy>;
      }

      export interface ShExReportItem {
        type: string;
        property?: string;
        node?: string;
        shape?: string;
        unexpectedTriples?: Array<{ predicate?: string }>;
        triple?: { subject?: string };
        ctx?: { predicate?: string };
        code?: string;
        constraint?: { predicate?: string };
        errors: Array<ShExReportItem>
      }

      export type ShExReport = ShExReportItem | Array<ShExReportItem>;

      export interface TripleConstraint {
        type: 'TripleConstraint';
        predicate: string;
        annotations?: Array<{
          predicate: string;
          object: { value: string };
        }>;
      }

      export interface ShExTargetShape {
        type: 'Shape';
        id: string;
        expression: {
          type: string;
          expressions: Array<TripleConstraint>;
        };
      }

      export interface ShExIntermediateShape {
        type: 'ShapeAnd' | 'ShapeOr';
        shapeExprs: Array<ShExShape>;
        id: string;
      }

      export type ShExShape = ShExTargetShape | ShExIntermediateShape;

      export interface ShExSchema {
        type: string;
        shapes: Array<ShExShape>;
      }

      export interface ExpandedSchemaRepresentationItem {
        [schemaRef: string]: Array<
          string |
          {
            '@id'?: string;
            '@type'?: string;
            '@value'?: string;
          }
        >;
      }

      export type ExpandedSchemaRepresentation =
        | Array<ExpandedSchemaRepresentationItem>
        | ExpandedSchemaRepresentationItem;
    }
  }
}

// empty export to keep file a module
export { };
